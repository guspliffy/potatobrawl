/* ===================== drawing: fighters ===================== */
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const ease = (x) => x * x * (3 - 2 * x);
function rot(p, c, a) { const dx = p[0] - c[0], dy = p[1] - c[1], cs = Math.cos(a), sn = Math.sin(a); return [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs]; }

function pose(f, tk) {
  const L_ = f.spec.look, s = f.s, w = s.w, h = s.h;
  const leg = h * L_.leg, tor = h * L_.torso, hr = h * L_.headR;
  const P = { leg, tor, hr, w, h, crouch: 0, lean: 0, spin: 0, swoosh: null, dim: false, mouth: 0, tailTo: null, flap: 0,
    // heavy-attack extras (see HEAVY_LOOK): glint, wings, hop, weapon angle, sheathed blade, tail whirl, crystal, raven, flask
    pre: 0, hv: null, wingUp: 0, hop: 0, holdAng: null, sheath: 0, tailSwing: null, tailLift: 0, cryK: 1, ravenK: 0, ravenTo: null, flask: 0, hornFlash: 0, glintAt: null,
    // charge-up (a ground heavy held at its hold point): chg frames, whether it is waiting right now, the 1 px jitter at full charge
    chg: 0, hold: false, jit: [0, 0],
    // Gunslinger: the back pistol's angle (null = at rest) and which pistol has just fired (draws the muzzle flash)
    gunB: null, shotF: -1, shotB: -1,
    // Reaper: scythe blade side (+1 / -1), handle foreshortening (flat swings), scythe drawn behind the body, a light's trail, the Grave rise cloud
    bladeS: 1, scyK: 1, scyBack: false, reapT: null, cloud: 0, noSwoosh: false };
  let fF = [w * 0.24, 0], fB = [-w * 0.2, 0];
  let hF = [w * 0.5, -leg - tor * 0.52], hB = [w * 0.2, -leg - tor * 0.42];
  const st = f.state;
  let bob = 0;
  if (st === "idle" || st === "getup" || st === "respawn" || st === "fin") bob = Math.sin(tk * 0.09 + f.slot * 2) * 1.6;
  if (st === "land" || st === "jumpsquat" || st === "getup") P.crouch = 0.35;
  if (st === "run") {
    const ph = f.anim.run;
    fF = [Math.sin(ph) * w * 0.55, -Math.max(0, Math.cos(ph)) * 10];
    fB = [-Math.sin(ph) * w * 0.55, -Math.max(0, -Math.cos(ph)) * 10];
    hF = [w * 0.15 - Math.sin(ph) * w * 0.45, -leg - tor * 0.45];
    hB = [w * 0.05 + Math.sin(ph) * w * 0.45, -leg - tor * 0.4];
    P.lean = 0.16;
  }
  const airy = st === "air" || st === "helpless" || (st === "dodge" && f.dodgeKind === "air");
  if (airy) {
    fF = [w * 0.32, -leg * 0.42]; fB = [-w * 0.12, -leg * 0.22];
    if (f.vy < 0) { hF = [w * 0.32, -leg - tor * 1.15]; hB = [-w * 0.3, -leg - tor * 1.05]; }
    else { hF = [w * 0.55, -leg - tor * 0.75]; hB = [-w * 0.35, -leg - tor * 0.65]; }
  }
  if (st === "helpless") { P.dim = true; hF = [w * 0.25, -leg - tor * 1.25]; hB = [-w * 0.2, -leg - tor * 1.25]; }
  if (st === "helpless" && L_.costume === "reaper") {   // the drift after Grave rise: scythe held up, the free arm out, a thin wisp under him
    hF = [w * 0.62, -leg - tor * 1.0]; hB = [-w * 0.62, -leg - tor * 0.78]; fF = [w * 0.12, -leg * 0.15]; fB = [-w * 0.18, -leg * 0.05];
    P.holdAng = -1.62 + Math.sin(tk * 0.12) * 0.06; P.cloud = 0.42;
  }
  if (st === "hitstun") {
    P.spin = f.tumble ? f.st * 0.3 * (f.kbx * f.facing >= 0 ? -1 : 1) : 0;
    P.lean = f.tumble ? 0 : -0.3;
    fF = [w * 0.42, -leg * 0.25]; fB = [-w * 0.42, -leg * 0.12];
    hF = [w * 0.6, -leg - tor * 1.1]; hB = [-w * 0.55, -leg - tor * 1.0];
  }
  if (st === "dodge") {
    if (f.dodgeKind === "roll") { P.spin = (f.st / 24) * Math.PI * 2 * f.dodgeDir[0] * f.facing; P.crouch = 0.3; fF = [w * 0.2, -leg * 0.5]; fB = [-w * 0.1, -leg * 0.4]; }
    else if (f.dodgeKind === "spot") { P.crouch = 0.25; hF = [w * 0.3, -leg - tor * 0.9]; hB = [w * 0.1, -leg - tor * 0.9]; }
  }
  if (st === "ledge") {
    hF = [w * 0.5 + 2, -h + 8]; hB = [w * 0.38, -h + 6];
    fF = [w * 0.15, 2]; fB = [-w * 0.08, 6]; P.lean = 0.12;
  }
  if (st === "attack" && f.move) {
    const m = f.move, a0 = m.startup + 1, a1 = m.startup + m.active;
    const b = m.boxes[0];
    const hk = HEAVY_KEYS[f.mid] === 1 ? f.mid : null;   // a heavy: gets the shared heavy language plus its HEAVY_LOOK entry
    let tx = w * 0.9, ty = -leg - tor * 0.6;
    if (b) { const t = m.active > 1 ? clamp((f.mt - a0) / (m.active - 1), 0, 1) : 0; tx = b.x + (b.x2 - b.x) * t; ty = b.y + (b.y2 - b.y) * t; }
    const phase = f.mt < a0 ? 0 : f.mt <= a1 ? 1 : 2;
    const k = phase === 0 ? f.mt / Math.max(1, m.startup) : phase === 2 ? (f.mt - a1) / Math.max(1, m.endlag) : 1;
    // heavies pull the limb much further back before they swing
    const wind = hk ? [-Math.abs(tx) * 0.45 - w * 0.4, ty * 0.7 + 10] : [-Math.abs(tx) * 0.3 - w * 0.25, ty * 0.85 + 4];
    const reach = (rest) => (phase === 0 ? lerp2(rest, wind, ease(k)) : phase === 1 ? [tx, ty] : lerp2([tx, ty], rest, ease(k)));
    if (m.limb === "arm") hF = reach(hF);
    else if (m.limb === "leg") { fF = reach(fF); if (phase < 2) P.lean = ty > -leg ? -0.2 : 0; }
    else if (m.limb === "both") { hF = reach(hF); if (phase > 0) fF = [w * 0.55, 0]; P.lean = phase === 0 ? -0.25 * ease(k) : phase === 1 ? 0.25 : 0.25 * (1 - k); }
    else if (m.limb === "tail") { P.tailTo = reach([-w * 1.3, -leg * 0.4]); P.lean = phase === 1 ? 0.15 : 0; }
    else if (m.limb === "head") {
      P.lean = phase === 0 ? -0.18 * ease(k) : phase === 1 ? 0.3 : 0.3 * (1 - k);
      P.mouth = phase === 0 ? 0.4 * k : phase === 1 ? 1 : 1 - k;
      hF = [w * 0.35, -leg - tor * 0.35]; hB = [w * 0.05, -leg - tor * 0.3];
    }
    else if (m.limb === "body") {
      if (phase === 1) P.spin = ((f.mt - a0) / m.active) * Math.PI * 2;
      fF = [w * 0.3, -leg * 0.45]; fB = [-w * 0.2, -leg * 0.3];
      hF = [w * 0.6, -leg - tor * 0.7]; hB = [-w * 0.55, -leg - tor * 0.7];
    }
    if (m.boxes[1] && m.limb !== "body") { const b2 = m.boxes[1]; const rest = fB; fB = phase === 1 ? [b2.x, b2.y] : phase === 0 ? lerp2(rest, [0, -leg * 0.4], ease(k)) : lerp2([b2.x, b2.y], rest, ease(k)); }
    if (m.kind === "dash") {
      P.spin = 0; P.lean = phase === 1 ? 0.75 : 0.2;
      hF = [-w * 0.3, -leg - tor * 0.5]; hB = [-w * 0.6, -leg - tor * 0.35]; fF = [-w * 0.1, -leg * 0.25]; fB = [-w * 0.55, -leg * 0.15];
    }
    if (phase === 1) P.mouth = Math.max(P.mouth, 1);
    if (m.kind === "projectile" && m.limb !== "head") { hF = phase === 0 ? lerp2(hF, [-w * 0.6, -leg - tor * 0.9], ease(k)) : lerp2([w * 1.1, -leg - tor * 0.7], hF, phase === 2 ? ease(k) : 0); }
    if (m.kind === "projectile" && L_.costume === "gunslinger") gunShotPose(f, P, m, phase, k, w, leg, tor, (a, b) => { hF = a; if (b) hB = b; });
    // the Gunslinger's lights are point-blank shots (core: shot: true): the pistol points along the hitbox path
    if (m.shot && L_.costume === "gunslinger") gunLightPose(f, P, m, phase, k, w, leg, tor, (a, b) => { if (a) hF = a; if (b) hB = b; });
    // Powder jump (Gunslinger): the front pistol points straight down and fires once as he lifts off
    if (m.rec && L_.costume === "gunslinger") {
      const sk = f.mt - m.startup;
      hF = [w * 0.34, -leg * 0.2 - (sk < 0 ? 6 : sk < 4 ? 6 - sk * 1.5 : 0)]; P.holdAng = 1.42; P.lean = -0.1;
      if (sk >= 0 && sk < 3) P.shotF = sk;
    }
    if (m.kind === "charge" && phase === 0) P.crouch = 0.3 * ease(k);
    if (m.pound) { fF = [w * 0.08, 4]; fB = [-w * 0.12, 2]; hF = [w * 0.42, -leg - tor * 1.15]; hB = [-w * 0.42, -leg - tor * 1.1]; }
    if (L_.costume === "reaper" && !HEAVY_KEYS[f.mid]) reaperPose(f, P, m, f.mid, phase, k, w, leg, tor, (a, b, c2, d) => { hF = a; if (b) hB = b; if (c2) fF = c2; if (d) fB = d; });
    // an Ultimate (see the Ultimates section at the end of this file; the Reaper's is in reaperPose)
    if (m.ult && L_.costume !== "reaper") ultPose(f, P, m, phase, k, w, leg, tor, { hF, hB, fF, fB }, (a, b, c2, d) => { if (a) hF = a; if (b) hB = b; if (c2) fF = c2; if (d) fB = d; });
    let look = null, replace = false;
    if (hk) {
      // shared heavy language: a deeper crouch while winding up, a glint in the last two startup frames
      const air = !f.grounded, wk = phase === 0 ? ease(clamp(f.mt / Math.max(1, m.startup - 1), 0, 1)) : 1;
      P.crouch = Math.max(P.crouch, phase === 0 ? (air ? 0.12 : 0.25) * wk : phase === 2 ? (air ? 0.1 : 0.2) * (1 - ease(k)) : 0);
      P.pre = phase === 0 && f.mt >= m.startup - 1 ? (f.mt >= m.startup ? 1 : 0.6) : 0;
      if (f.chg > 0 && m.charge) {
        P.chg = f.chg; P.hold = f.mt === m.startup - BL.TUNE.chgHold;
        if (P.hold && f.chg > 40) P.jit = [(tk & 1 ? 1 : -1) * 0.9, ((tk >> 1) & 1 ? 1 : -1) * 0.6];   // stage 3: the body shakes, 1 px (UI only)
        if (P.hold) P.cryK = 1 + (f.chg > 40 ? 0.7 : f.chg > 20 ? 0.4 : 0.15);   // the Wizard's crystal swells with the charge
      }
      look = HEAVY_LOOK[f.spec.id] && HEAVY_LOOK[f.spec.id][hk] || null;
      const X = { P, f, m, key: hk, phase, k, u: phase === 0 ? 0 : phase === 1 ? (m.active > 1 ? (f.mt - a0) / (m.active - 1) : 1) : 1, wk, mt: f.mt, startup: m.startup, active: m.active, a0, a1, age: f.mt - a0,
        tx, ty, b, w, h, leg, tor, air, hF, hB, fF, fB, replace: false };
      if (look && look.pose) look.pose(X);
      hF = X.hF; hB = X.hB; fF = X.fF; fB = X.fB; replace = X.replace;
      P.hv = { id: f.spec.id, key: hk, look, phase, k, u: X.u, wk, age: X.age, ck: P.chg ? P.chg / BL.TUNE.chgMax : 0, startup: m.startup, active: m.active, a0, a1, tx, ty, b, trail: X.trail || null };
    }
    const lingerEnd = a1 + (look && look.linger != null ? look.linger : 0);
    if (b && !replace && !P.noSwoosh && (phase === 1 || (phase === 2 && f.mt <= lingerEnd && look && look.keepSwoosh))) {
      P.swoosh = { tx, ty, r: b.r, body: m.limb === "body", sweep: b.x2 !== b.x || b.y2 !== b.y, sx: b.x, sy: b.y, heavy: m.dmg >= 12, fire: !!m.fire, hv: !!hk, linger: phase === 2, age: f.mt - a0, key: hk, ck: P.chg ? P.chg / BL.TUNE.chgMax : 0 };
    }
  }
  if (L_.wings) {
    const fast = st === "attack" && f.move && (f.move.rec || f.mid === "spec");
    P.flap = f.grounded || st === "ledge" ? 0 : Math.sin(tk * (fast ? 0.9 : 0.35)) * (f.vy < 0 || fast ? 0.6 : 0.3);
  }
  // KO finisher stand-ins bend their own skeleton (ui/finisher.js)
  let finArms = false;
  if (f.finPose) {
    const o = f.finPose(P, { w, leg, tor });
    if (o) { finArms = !!(o.hF || o.hB); if (o.fF) fF = o.fF; if (o.fB) fB = o.fB; if (o.hF) hF = o.hF; if (o.hB) hB = o.hB; }
  }
  // assemble skeleton
  const drop = P.crouch * leg * 0.45 - bob;
  P.hip = [0, -leg + drop];
  P.sh = [0, -leg - tor * 0.86 + drop];
  P.head = [w * 0.05, -leg - tor - hr * 0.85 + drop];
  P.fF = fF; P.fB = fB; P.hF = hF; P.hB = hB;
  if (L_.build === "potato") {
    P.top = P.hip[1] - (h - leg) + 2;
    const by = P.hip[1] + 5;
    P.cy = (by + P.top) / 2; P.ry = (by - P.top) / 2; P.rx = w * 0.56;
    P.sh = [w * 0.38, P.cy + P.ry * 0.15]; P.shB = [-w * 0.32, P.cy + P.ry * 0.15];
    P.hipF = [w * 0.15, P.hip[1]]; P.hipB = [-w * 0.13, P.hip[1]];
    P.head = [w * 0.16, P.cy - P.ry * 0.28];
    P.mouthPt = [w * 0.16, P.cy - P.ry * 0.28 + w * 0.23];
    // arms hang outside the round body when they're not doing something
    if (st !== "attack" && st !== "ledge" && st !== "hitstun" && !finArms && !(st === "helpless" && L_.costume === "reaper")) {
      if (P.hF[0] < w * 0.75) P.hF = [w * 0.75 + (P.hF[0] - w * 0.5) * 0.4, P.hF[1] + 4];
      if (P.hB[0] > -w * 0.68) P.hB = [-w * 0.68 + (P.hB[0] + w * 0.3) * 0.3, P.hB[1] + 4];
      if (L_.costume === "reaper" && st !== "helpless") P.hF = [w * 0.9 + (st === "run" ? (P.hF[0] - w * 0.75) * 0.5 : 0), P.hF[1] + tor * 0.16];   // the scythe held out at his side, clear of the face
    }
  }
  return P;
}

function limbPath(c, a, b, len, bend, wdt, col) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  const half = len / 2;
  let mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (d < len) {
    const off = Math.sqrt(Math.max(0, half * half - (d / 2) * (d / 2)));
    let nx = -dy / d, ny = dx / d;
    if (bend === "fwd" ? nx < 0 : ny < 0) { nx = -nx; ny = -ny; }
    mid = [mid[0] + nx * off, mid[1] + ny * off];
  }
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(mid[0], mid[1]); c.lineTo(b[0], b[1]);
  c.strokeStyle = OUT; c.lineWidth = wdt + 3.5; c.stroke();
  c.strokeStyle = col; c.lineWidth = wdt; c.stroke();
}

function drawTorso(c, look, P, pal, X) {
  const w = P.w, top = P.sh[1] - 3, bot = P.hip[1] + 3;
  c.beginPath();
  if (look.build === "wedge") {
    c.moveTo(-w * 0.44, top + 2); c.lineTo(w * 0.52, top); c.lineTo(w * 0.24, bot); c.lineTo(-w * 0.22, bot); c.closePath();
  } else if (look.build === "block") {
    c.roundRect(-w * 0.56, top - 2, w * 1.12, bot - top + 4, 10);
  } else if (look.build === "dragon") {
    c.roundRect(-w * 0.44, top - 2, w * 0.88, bot - top + 6, 13);
  } else if (look.build === "potato") {
    const by = P.hip[1] + 5, cy = (by + P.top) / 2, ry = (by - P.top) / 2, rx = w * 0.56;
    c.moveTo(rx, cy);
    for (let i = 1; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2, bump = 1 + 0.035 * Math.sin(a * 5 + 1.3) + 0.02 * Math.sin(a * 3);
      c.lineTo(Math.cos(a) * rx * bump, cy + Math.sin(a) * ry * bump);
    }
    c.closePath();
  } else {
    c.roundRect(-w * 0.31, top, w * 0.62, bot - top, w * 0.28);
  }
  c.fillStyle = pal.body; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  // detail
  c.save(); c.clip();
  if (look.build === "wedge") {
    c.strokeStyle = pal.trim; c.lineWidth = 3; c.beginPath();
    const y0 = top + (bot - top) * 0.25, y1 = top + (bot - top) * 0.75;
    c.moveTo(w * 0.15, y0); c.lineTo(-w * 0.05, (y0 + y1) / 2); c.lineTo(w * 0.12, (y0 + y1) / 2); c.lineTo(-w * 0.08, y1); c.stroke();
  } else if (look.build === "block") {
    c.fillStyle = pal.trim; c.fillRect(-w, bot - 9, w * 2, 6);
    c.fillStyle = X.hi; c.fillRect(-w * 0.45, top + 4, w * 0.5, 4);
  } else if (look.build === "dragon") {
    const mid = (top + bot) / 2;
    c.fillStyle = pal.accent; c.beginPath(); c.ellipse(w * 0.2, mid + 2, w * 0.26, (bot - top) * 0.46, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = rgba(pal.trim, 0.35); c.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(w * 0.0, mid + i * 6); c.lineTo(w * 0.42, mid + i * 6); c.stroke(); }
  } else if (look.build === "potato") {
    const by = P.hip[1] + 5, ry = (by - P.top) / 2;
    c.fillStyle = mix(pal.body, "#1a1208", 0.35);
    for (const [sx, sy, sr] of [[-0.28, 0.25, 2.2], [0.05, 0.62, 1.8], [-0.12, -0.35, 1.6], [0.32, 0.2, 1.4]]) {
      c.beginPath(); c.ellipse(sx * w, P.top + ry + sy * ry, sr * 1.6, sr, 0.4, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = rgba("#ffffff", 0.22); c.lineWidth = 3;
    c.beginPath(); c.ellipse(-w * 0.08, P.top + ry, w * 0.42, ry * 0.8, 0, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
  } else {
    c.strokeStyle = pal.trim; c.lineWidth = 5; c.beginPath(); c.moveTo(-w * 0.4, top + 4); c.lineTo(w * 0.4, bot - 6); c.stroke();
  }
  c.restore();
}
function drawHead(c, look, P, pal) {
  const [hx, hy] = P.head, r = P.hr;
  c.lineWidth = 2.5; c.strokeStyle = OUT;
  if (look.head === "crest") {
    c.beginPath();
    c.moveTo(hx - r * 0.5, hy - r * 0.55); c.lineTo(hx - r * 1.7, hy - r * 1.35); c.lineTo(hx - r * 0.9, hy - r * 1.05);
    c.lineTo(hx - r * 1.35, hy - r * 2.0); c.lineTo(hx + r * 0.25, hy - r * 0.8); c.closePath();
    c.fillStyle = pal.accent; c.fill(); c.stroke();
    c.beginPath(); c.arc(hx, hy, r, 0, Math.PI * 2); c.fillStyle = pal.body; c.fill(); c.stroke();
    c.beginPath(); c.roundRect(hx - r * 0.05, hy - r * 0.38, r * 1.12, r * 0.46, r * 0.22); c.fillStyle = pal.trim; c.fill();
    c.fillStyle = pal.accent; c.fillRect(hx + r * 0.55, hy - r * 0.28, r * 0.3, r * 0.12);
  } else if (look.head === "brute") {
    c.beginPath(); c.roundRect(hx - r, hy - r * 0.9, r * 2, r * 1.8, r * 0.45); c.fillStyle = pal.body; c.fill(); c.stroke();
    c.save(); c.clip(); c.fillStyle = pal.trim; c.fillRect(hx - r * 1.2, hy - r * 1.0, r * 2.4, r * 0.62); c.restore();
    c.fillStyle = pal.accent; c.fillRect(hx + r * 0.1, hy - r * 0.18, r * 0.75, r * 0.2);
  } else if (look.head === "dragon") {
    c.fillStyle = "#efe6cf";
    c.beginPath(); c.moveTo(hx - r * 0.2, hy - r * 0.75); c.quadraticCurveTo(hx - r * 1.1, hy - r * 1.3, hx - r * 1.7, hy - r * 1.55); c.lineTo(hx - r * 0.75, hy - r * 0.35); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(hx + r * 0.2, hy - r * 0.85); c.quadraticCurveTo(hx - r * 0.4, hy - r * 1.6, hx - r * 0.9, hy - r * 2.0); c.lineTo(hx - r * 0.25, hy - r * 0.6); c.closePath(); c.fill(); c.stroke();
    c.save(); c.translate(hx + r * 0.25, hy + r * 0.1); c.rotate(P.mouth * 0.55);
    c.beginPath(); c.roundRect(0, -r * 0.05, r * 1.3, r * 0.45, r * 0.2); c.fillStyle = mix(pal.body, "#0b0c18", 0.25); c.fill(); c.stroke();
    c.restore();
    if (P.mouth > 0.3) { c.fillStyle = `rgba(255,170,60,${P.mouth * 0.9})`; c.beginPath(); c.arc(hx + r * 1.1, hy + r * 0.25, r * 0.32 * P.mouth, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(hx, hy, r, 0, Math.PI * 2); c.fillStyle = pal.body; c.fill(); c.stroke();
    c.beginPath(); c.roundRect(hx + r * 0.15, hy - r * 0.5, r * 1.5, r * 0.62, r * 0.28); c.fill(); c.stroke();
    c.fillStyle = OUT; c.beginPath(); c.arc(hx + r * 1.45, hy - r * 0.3, r * 0.09, 0, Math.PI * 2); c.fill();
    c.fillStyle = pal.accent; c.beginPath(); c.ellipse(hx + r * 0.05, hy - r * 0.32, r * 0.32, r * 0.22, -0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = OUT; c.fillRect(hx + r * 0.08, hy - r * 0.48, r * 0.1, r * 0.32);
  } else if (look.head === "potato") {
    const er = Math.max(3.2, r * 0.42);
    for (const [ex, ey] of [[hx - r * 0.25, hy], [hx + r * 0.8, hy + r * 0.05]]) {
      c.beginPath(); c.arc(ex, ey, er, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.arc(ex + er * 0.3, ey + er * 0.1, er * 0.5, 0, Math.PI * 2); c.fillStyle = OUT; c.fill();
    }
    c.strokeStyle = OUT; c.lineWidth = 1.8;
    if (P.mouth > 0.5) { c.beginPath(); c.ellipse(hx + r * 0.35, hy + r * 1.05, r * 0.32, r * 0.24, 0, 0, Math.PI * 2); c.fillStyle = "#3a1a14"; c.fill(); }
    else { c.beginPath(); c.arc(hx + r * 0.35, hy + r * 0.7, r * 0.35, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke(); }
    const sx = -P.w * 0.04, sy = P.top + 1;
    c.strokeStyle = "#3f7d4a"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(sx, sy + 2); c.quadraticCurveTo(sx - 1, sy - 4, sx + 1, sy - 8); c.stroke();
    c.fillStyle = "#6fbf73";
    c.beginPath(); c.ellipse(sx - 4, sy - 8, 4.5, 2.2, -0.5, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.ellipse(sx + 5, sy - 9, 4.5, 2.2, 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
  } else {
    c.beginPath(); c.moveTo(hx, hy - r * 1.2); c.lineTo(hx + r * 1.0, hy); c.lineTo(hx, hy + r * 1.05); c.lineTo(hx - r * 1.0, hy); c.closePath();
    c.fillStyle = pal.body; c.fill(); c.stroke();
    c.save(); c.clip(); c.fillStyle = pal.trim; c.fillRect(hx - r * 1.2, hy - r * 0.32, r * 2.4, r * 0.42); c.restore();
    c.beginPath(); c.arc(hx + r * 0.42, hy - r * 0.1, r * 0.16, 0, Math.PI * 2); c.fillStyle = OUT; c.fill();
  }
}

function drawScarf(c, f, tk) {
  const a = f.anim;
  const L_ = f.spec.look, s = f.s;
  const nx = f.x - f.facing * s.w * 0.1, ny = f.y - s.h * (L_.leg + L_.torso * 0.95);
  if (!a.scarf) a.scarf = Array.from({ length: 5 }, () => [nx, ny]);
  const pts = a.scarf;
  pts[0] = [nx, ny];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = pts[i - 1];
    const tx = q[0] - f.facing * 6 - (f.vx + f.kbx) * 0.4, ty = q[1] + 3.5 + Math.sin(tk * 0.2 + i * 0.9) * 2 - (f.vy + f.kby) * 0.3;
    p[0] += (tx - p[0]) * 0.5; p[1] += (ty - p[1]) * 0.5;
    const dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy);
    if (d > 8) { p[0] = q[0] + (dx / d) * 8; p[1] = q[1] + (dy / d) * 8; }
  }
  c.lineCap = "round"; c.lineJoin = "round";
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]);
  c.strokeStyle = OUT; c.lineWidth = 9; c.stroke();
  c.strokeStyle = f.pal.trim; c.lineWidth = 6; c.stroke();
}

function drawTail(c, P, pal, X, tk, slot) {
  const w = P.w, base = [-w * 0.25, P.hip[1] - 2];
  const tip = P.tailTo || [-w * 1.3, P.hip[1] + P.leg * 0.55 + Math.sin(tk * 0.08 + slot) * 3];
  const dx = tip[0] - base[0], dy = tip[1] - base[1], d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d, ny = dx / d; if (nx > 0) { nx = -nx; ny = -ny; }
  const bulge = P.tailTo ? d * 0.4 : d * 0.25;
  const ctrl = [(base[0] + tip[0]) / 2 + nx * bulge, (base[1] + tip[1]) / 2 + ny * bulge + (P.tailTo ? 0 : 8)];
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10, u = 1 - t; pts.push([u * u * base[0] + 2 * u * t * ctrl[0] + t * t * tip[0], u * u * base[1] + 2 * u * t * ctrl[1] + t * t * tip[1]]); }
  c.lineCap = "round";
  for (const pass of [0, 1]) {
    for (let i = 1; i < pts.length; i++) {
      const wd = lerp(P.leg * 0.55, 3, i / pts.length);
      c.strokeStyle = pass ? pal.body : OUT; c.lineWidth = pass ? wd : wd + 3.5;
      c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    }
  }
  const a = pts[10], b = pts[8], ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
  c.save(); c.translate(a[0], a[1]); c.rotate(ang);
  c.beginPath(); c.moveTo(9, 0); c.lineTo(-2, -6); c.lineTo(1, 0); c.lineTo(-2, 6); c.closePath();
  c.fillStyle = pal.accent; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
  c.restore();
}
function drawWing(c, P, pal, f) {
  const w = P.w, anchor = rot([-w * 0.1, P.sh[1] + 5], P.hip, P.lean);
  const air = !f.grounded && f.state !== "ledge";
  const span = w * (air ? 1.35 : 0.95);
  const ang = air ? -0.45 + P.flap : 0.3;
  const shape = [[0, 0], [-span * 0.5, -span * 0.75], [-span, -span * 0.5], [-span * 0.82, -span * 0.08], [-span * 0.52, span * 0.12], [-span * 0.24, span * 0.08]];
  const pts = shape.map((p) => { const cs = Math.cos(ang), sn = Math.sin(ang); return [anchor[0] + p[0] * cs - p[1] * sn, anchor[1] + p[0] * sn + p[1] * cs]; });
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  c.lineTo(pts[1][0], pts[1][1]); c.lineTo(pts[2][0], pts[2][1]);
  c.quadraticCurveTo((pts[2][0] + pts[3][0]) / 2 + 4, (pts[2][1] + pts[3][1]) / 2, pts[3][0], pts[3][1]);
  c.quadraticCurveTo((pts[3][0] + pts[4][0]) / 2 + 4, (pts[3][1] + pts[4][1]) / 2, pts[4][0], pts[4][1]);
  c.quadraticCurveTo((pts[4][0] + pts[5][0]) / 2 + 3, (pts[4][1] + pts[5][1]) / 2, pts[5][0], pts[5][1]);
  c.closePath();
  c.fillStyle = mix(pal.body, pal.trim, 0.35); c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = pal.trim; c.lineWidth = 2.5; c.lineCap = "round";
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.lineTo(pts[2][0], pts[2][1]);
  c.moveTo(pts[1][0], pts[1][1]); c.lineTo(pts[3][0], pts[3][1]); c.moveTo(pts[1][0], pts[1][1]); c.lineTo(pts[4][0], pts[4][1]); c.stroke();
}
function drawFlame(c, P, S, tk) {
  const m = rot(P.mouthPt || [P.head[0] + P.hr * 1.5, P.head[1] + P.hr * 0.25], P.hip, P.lean);
  const big = S.hv ? 1.5 : 1;   // heavy flames are half as big again
  const len = (Math.hypot(S.tx - m[0], S.ty - m[1]) + S.r) * (S.hv ? 1.2 : 1), ang = Math.atan2(S.ty - m[1], S.tx - m[0]);
  const fl = Math.sin(tk * 1.3) * 3;
  c.save(); c.translate(m[0], m[1]); c.rotate(ang);
  const gr = c.createLinearGradient(0, 0, len, 0);
  gr.addColorStop(0, "#fff6c8"); gr.addColorStop(0.3, "#ffc04d"); gr.addColorStop(0.7, "#ff6a2b"); gr.addColorStop(1, "rgba(255,70,30,0)");
  c.fillStyle = gr; c.globalAlpha = 0.95;
  const R = S.r * big;
  c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(len * 0.5, -(R + fl), len, -R * 0.35);
  c.lineTo(len, R * 0.35); c.quadraticCurveTo(len * 0.5, R + fl, 0, 3); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,250,220,0.85)";
  c.beginPath(); c.moveTo(0, -1.5); c.quadraticCurveTo(len * 0.4, -R * 0.35, len * 0.65, 0); c.quadraticCurveTo(len * 0.4, R * 0.35, 0, 1.5); c.fill();
  if (S.hv) {
    // ember comet: sparks stream off the tip of a heavy flame
    for (let i = 0; i < 7; i++) {
      const q = ((tk * 0.09 + i * 0.37) % 1), ex = len * (0.55 + q * 0.7), ey = Math.sin(tk * 0.7 + i * 2.3) * R * (0.4 + q * 0.5);
      c.fillStyle = q < 0.5 ? "#ffe08a" : "#ff8a3d"; c.globalAlpha = 0.9 * (1 - q); c.beginPath(); c.arc(ex, ey, 3.2 * (1 - q * 0.6), 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}

/* ===================== potato fighters =====================
   One shared potato body and face, plus a costume per fighter: flame wings (Phoenix),
   hood, cape and orb (Alchemist), hair, beard, armor, cape and raven (Odin), hat and
   staff (Wizard), sash and katana (Samurai). */
const LIMB = "#2b2934", LIMB_BACK = "#1c1b23";
const SPECKS = [[-0.55, 0.35, 1.3], [-0.2, 0.62, 1.1], [0.36, 0.5, 1.2], [-0.62, -0.05, 1], [0.05, 0.3, 0.9], [0.58, 0.18, 1]];
function potatoPath(c, P) {
  const { rx, ry, cy } = P;
  c.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const bump = 1 + 0.025 * Math.sin(a * 4 + 0.7) + 0.015 * Math.sin(a * 7 + 2);
    const wide = 1 + 0.07 * Math.sin(a);
    const x = Math.cos(a) * rx * bump * wide, y = cy + Math.sin(a) * ry * bump;
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.closePath();
}
function potatoBody(c, P, pal) {
  const { rx, ry, cy } = P;
  potatoPath(c, P);
  const g = c.createRadialGradient(-rx * 0.35, cy - ry * 0.45, ry * 0.1, 0, cy, ry * 1.3);
  g.addColorStop(0, mix(pal.body, "#ffffff", 0.35)); g.addColorStop(0.55, pal.body); g.addColorStop(1, mix(pal.body, "#6b3a12", 0.35));
  c.fillStyle = g; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = mix(pal.body, "#5a3410", 0.45);
  for (const [sx, sy, sr] of SPECKS) { c.beginPath(); c.ellipse(sx * rx, cy + sy * ry, sr, sr * 0.7, 0.5, 0, Math.PI * 2); c.fill(); }
}
function leaf(c, x, y, s, a) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.beginPath(); c.ellipse(0, 0, 5.5 * s, 2.6 * s, 0, 0, Math.PI * 2);
  c.fillStyle = "#7cc85a"; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = "#4f9a3c"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-4 * s, 0); c.lineTo(4 * s, 0); c.stroke();
  c.restore();
}
function sprout(c, x, y, s) {
  c.strokeStyle = "#3f7d3a"; c.lineWidth = 2.2; c.lineCap = "round";
  c.beginPath(); c.moveTo(x, y + 2); c.quadraticCurveTo(x - 1, y - 4 * s, x + 1, y - 7 * s); c.stroke();
  leaf(c, x - 5 * s, y - 8 * s, s, -0.5); leaf(c, x + 6 * s, y - 9 * s, s, 0.5);
}
function potatoFace(c, f, P, look) {
  const w = P.w, [hx, hy] = P.head, er = w * 0.1;
  const e1 = [hx - w * 0.14, hy], e2 = [hx + w * 0.13, hy];
  const hurt = f.state === "hitstun", style = look.face, cos = look.costume;
  // P.expr (manga finisher, ui/manga.js): terror | grin | rage | calm | dazed | ko; P.exK 0..1 is how far into it the face is. Unset: the face is drawn as always.
  const ex = P.expr || "", xk = P.exK === undefined ? 1 : P.exK;
  c.fillStyle = "rgba(255,105,105,0.5)";
  c.beginPath(); c.ellipse(e1[0] - er * 0.4, hy + er * 1.75, er * 0.85, er * 0.5, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(e2[0] + er * 0.55, hy + er * 1.75, er * 0.85, er * 0.5, 0, 0, Math.PI * 2); c.fill();
  c.lineCap = "round"; c.lineJoin = "round";
  [e1, e2].forEach((e, i) => {
    if (hurt) {
      const s = i ? -1 : 1;
      c.strokeStyle = OUT; c.lineWidth = 2;
      c.beginPath(); c.moveTo(e[0] - s * er * 0.6, e[1] - er * 0.55); c.lineTo(e[0] + s * er * 0.5, e[1]); c.lineTo(e[0] - s * er * 0.6, e[1] + er * 0.55); c.stroke();
      return;
    }
    if (cos === "odin" && i === 0) {
      // the Allfather's eyepatch, strap running up over the hair
      c.fillStyle = "#2a1d18"; c.beginPath(); c.ellipse(e[0], e[1], er * 1.05, er * 1.0, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#2a1d18"; c.lineWidth = 1.8; c.beginPath(); c.moveTo(e[0] - er * 0.6, e[1] - er * 0.7); c.lineTo(e[0] - er * 2.2, e[1] - er * 3.2); c.moveTo(e[0] + er * 0.7, e[1] - er * 0.6); c.lineTo(e[0] + er * 2.4, e[1] - er * 2.6); c.stroke();
      return;
    }
    if (ex === "ko") {
      c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath();
      c.moveTo(e[0] - er * 0.8, e[1] - er * 0.8); c.lineTo(e[0] + er * 0.8, e[1] + er * 0.8); c.moveTo(e[0] + er * 0.8, e[1] - er * 0.8); c.lineTo(e[0] - er * 0.8, e[1] + er * 0.8); c.stroke();
      return;
    }
    if (ex === "calm") {   // closed eyes: a soft downward arc
      c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.arc(e[0], e[1] - er * 0.55, er * 1.05, 0.35, Math.PI - 0.35); c.stroke();
      return;
    }
    // terror: the eyes grow and the pupils shrink to pinpoints (xk 0..1); rage / grin: narrowed
    let k = style === "eager" ? 1.1 : 1, hk = style === "focused" ? 0.8 : 1, pk = 1;
    if (ex === "terror") { k *= 1 + 0.5 * xk; hk = 1; pk = 1 - 0.7 * xk; }
    else if (ex === "rage") hk = 0.8;
    else if (ex === "grin") hk = 0.88;
    c.beginPath(); c.ellipse(e[0], e[1], er * k, er * 1.15 * k * hk, 0, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
    if (ex === "dazed") {   // spiral eyes, no pupils
      c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath();
      for (let a = 0; a <= Math.PI * 5; a += 0.25) { const r = er * (0.12 + 0.82 * a / (Math.PI * 5)), x = e[0] + Math.cos(a + (i ? 2 : 0)) * r, y = e[1] + Math.sin(a + (i ? 2 : 0)) * r; if (a) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
      return;
    }
    c.beginPath(); c.arc(e[0] + er * 0.15, e[1] + er * 0.1, er * 0.68 * k * hk * (ex === "terror" ? 0.5 + 0.5 * pk : 1), 0, Math.PI * 2); c.fillStyle = cos === "dragon" ? "#e6a52a" : "#4a1f14"; c.fill();
    c.beginPath();
    if (cos === "dragon") c.ellipse(e[0] + er * 0.15, e[1] + er * 0.1, er * 0.13 * pk, er * 0.55 * pk, 0, 0, Math.PI * 2); else c.arc(e[0] + er * 0.15, e[1] + er * 0.1, er * 0.38 * k * hk * pk, 0, Math.PI * 2);
    c.fillStyle = "#120a08"; c.fill();
    c.beginPath(); c.arc(e[0] + er * 0.4, e[1] - er * 0.25, er * 0.22, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill();
    if (ex ? (ex === "rage" || ex === "grin") : (style === "focused" || style === "fierce" || style === "sly")) {
      // heavy upper lid in skin colour
      const s = i ? 1 : -1;
      c.save(); c.beginPath(); c.ellipse(e[0], e[1], er * k * 1.05, er * 1.2 * hk, 0, 0, Math.PI * 2); c.clip();
      c.fillStyle = f.pal.body; c.beginPath(); c.moveTo(e[0] - er * 1.3, e[1] - er * 1.4); c.lineTo(e[0] + er * 1.3, e[1] - er * 1.4);
      c.lineTo(e[0] + er * 1.3, e[1] - er * (0.25 + s * 0.3)); c.lineTo(e[0] - er * 1.3, e[1] - er * (0.25 - s * 0.3)); c.closePath(); c.fill();
      c.restore();
    }
    if (cos === "wizard") { c.strokeStyle = "#d8b04a"; c.lineWidth = 1.6; c.beginPath(); c.arc(e[0], e[1], er * 1.35, 0, Math.PI * 2); c.stroke(); }
  });
  if (cos === "wizard" && !hurt) { c.strokeStyle = "#d8b04a"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(e1[0] + er * 1.35, e1[1]); c.lineTo(e2[0] - er * 1.35, e2[1]); c.stroke(); }
  c.strokeStyle = style === "stern" ? "#f3efe6" : OUT;
  c.lineWidth = style === "stern" ? 3.4 : 2.2;
  [[e1, -1], [e2, 1]].forEach(([e, side]) => {
    c.beginPath();
    if (ex === "terror") { c.moveTo(e[0] + side * er * 1.0, e[1] - er * (1.7 + 0.5 * xk)); c.lineTo(e[0] - side * er * 0.8, e[1] - er * (2.1 + 0.9 * xk)); }   // raised, inner ends up: worried
    else if (ex === "rage") { c.lineWidth = 3.4; c.moveTo(e[0] + side * er * 1.1, e[1] - er * 2.0); c.lineTo(e[0] - side * er * 0.9, e[1] - er * 0.95); }   // hard down
    else if (ex === "grin") { c.moveTo(e[0] + side * er * 0.9, e[1] - er * (side > 0 ? 1.9 : 1.5)); c.lineTo(e[0] - side * er * 0.7, e[1] - er * (side > 0 ? 1.55 : 1.15)); }   // one brow up
    else if (ex === "ko") { c.moveTo(e[0] - er * 1.0, e[1] - er * 1.3); c.lineTo(e[0] + er * 1.0, e[1] - er * 1.3); }
    else if (ex === "calm" || ex === "dazed") c.arc(e[0], e[1] - er * 0.6, er * 1.1, -2.4, -0.75);
    else if (style === "evil" || style === "fierce" || style === "focused") { c.moveTo(e[0] + side * er * 0.9, e[1] - er * (style === "focused" ? 1.6 : 1.8)); c.lineTo(e[0] - side * er * 0.7, e[1] - er * (style === "focused" ? 1.15 : 1.2)); }
    else if (style === "stern") { c.moveTo(e[0] - er * 1.1, e[1] - er * 1.45); c.lineTo(e[0] + er * 1.1, e[1] - er * 1.3); }
    else if (style === "cocky") { c.lineWidth = 3; c.moveTo(e[0] + side * er * 1.0, e[1] - er * (side > 0 ? 1.95 : 1.75)); c.quadraticCurveTo(e[0], e[1] - er * 2.0, e[0] - side * er * 0.85, e[1] - er * 1.3); }
    // sly (Reaper): the back brow slants down hard to the nose, the front one arches high: one raised eyebrow
    else if (style === "sly" && side < 0) { c.lineWidth = 3.4; c.moveTo(e[0] - er * 1.15, e[1] - er * 2.05); c.lineTo(e[0] + er * 0.95, e[1] - er * 1.25); }
    else if (style === "sly") { c.lineWidth = 3.2; c.moveTo(e[0] - er * 0.85, e[1] - er * 1.75); c.quadraticCurveTo(e[0] + er * 0.05, e[1] - er * 2.75, e[0] + er * 1.15, e[1] - er * 1.95); }
    else c.arc(e[0], e[1] - er * 0.6, er * 1.1, -2.4, -0.75);
    c.stroke();
  });
  if (style === "stern") return;
  const mx = hx, my = hy + er * 2.3;
  c.strokeStyle = OUT;
  if (ex) {
    c.lineWidth = 1.8;
    if (ex === "terror") {
      c.beginPath(); c.ellipse(mx, my + er * 0.3, er * (0.7 + 0.35 * xk), er * (0.6 + 0.55 * xk), 0, 0, Math.PI * 2); c.fillStyle = "#5a1a14"; c.fill(); c.stroke();
    } else if (ex === "rage") {   // clenched teeth at P.mouth 0, a roaring mouth at 1; fangs on the Dragon
      const pm = clamp(P.mouth, 0, 1), mw = er * (1.5 + 0.9 * pm), mh = er * (0.35 + 1.6 * pm);
      c.beginPath(); c.moveTo(mx - mw, my - er * 0.2); c.quadraticCurveTo(mx, my - er * 0.5, mx + mw, my - er * 0.2); c.quadraticCurveTo(mx + mw * 0.8, my - er * 0.2 + mh, mx, my - er * 0.2 + mh * 1.1);
      c.quadraticCurveTo(mx - mw * 0.8, my - er * 0.2 + mh, mx - mw, my - er * 0.2); c.closePath();
      c.fillStyle = pm < 0.2 ? "#ffffff" : "#5a1a14"; c.fill(); c.stroke();
      c.fillStyle = "#ffffff";
      if (cos === "dragon" && pm >= 0.2) { for (const s of [-1, 1]) { c.beginPath(); c.moveTo(mx + s * mw * 0.55, my - er * 0.3); c.lineTo(mx + s * mw * 0.3, my - er * 0.3); c.lineTo(mx + s * mw * 0.45, my + er * (0.2 + 0.5 * pm)); c.closePath(); c.fill(); c.lineWidth = 0.9; c.stroke(); } }
      else if (pm < 0.2) { c.lineWidth = 1; c.beginPath(); for (let q = -2; q <= 2; q++) { c.moveTo(mx + q * mw * 0.38, my - er * 0.2); c.lineTo(mx + q * mw * 0.38, my - er * 0.2 + mh); } c.stroke(); }
    } else if (ex === "grin") {   // a lopsided smirk, a fang on the Dragon
      c.beginPath(); c.moveTo(mx - er * 1.1, my - er * 0.15); c.quadraticCurveTo(mx + er * 0.2, my + er * 1.2, mx + er * 1.5, my - er * 0.75); c.lineWidth = 2.2; c.stroke();
      if (cos === "dragon") { c.fillStyle = "#ffffff"; c.beginPath(); c.moveTo(mx + er * 0.45, my + er * 0.28); c.lineTo(mx + er * 0.75, my + er * 0.3); c.lineTo(mx + er * 0.66, my + er * 0.85); c.closePath(); c.fill(); c.lineWidth = 0.9; c.stroke(); }
    } else if (ex === "dazed") {
      c.beginPath(); c.moveTo(mx - er * 1.0, my); for (let q = 1; q <= 4; q++) c.lineTo(mx - er * 1.0 + q * er * 0.5, my + (q % 2 ? er * 0.35 : -er * 0.1)); c.stroke();
    } else if (ex === "ko") {
      c.beginPath(); c.ellipse(mx, my + er * 0.4, er * 0.55, er * 0.7, 0, 0, Math.PI * 2); c.fillStyle = "#5a1a14"; c.fill(); c.stroke();
    } else {   // calm
      c.beginPath(); c.arc(mx, my - er * 0.7, er * 0.85, 0.4, Math.PI - 0.4); c.stroke();
    }
    return;
  }
  if (P.mouth > 0.5 || hurt) {
    c.beginPath(); c.ellipse(mx, my + 1, er * 0.75, er * (hurt ? 0.5 : 0.65), 0, 0, Math.PI * 2);
    c.fillStyle = "#5a1a14"; c.fill(); c.lineWidth = 1.5; c.stroke();
  } else if (style === "evil") {
    c.beginPath(); c.moveTo(mx - er * 1.3, my - er * 0.3); c.quadraticCurveTo(mx, my + er * 1.3, mx + er * 1.3, my - er * 0.3);
    c.quadraticCurveTo(mx, my + er * 0.2, mx - er * 1.3, my - er * 0.3);
    c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 1.6; c.stroke();
    c.lineWidth = 1; c.beginPath(); c.moveTo(mx - er * 0.3, my + er * 0.05); c.lineTo(mx - er * 0.3, my + er * 0.6); c.moveTo(mx + er * 0.4, my + er * 0.05); c.lineTo(mx + er * 0.4, my + er * 0.55); c.stroke();
  } else if (style === "eager") {
    c.beginPath(); c.moveTo(mx - er * 1.1, my - er * 0.3); c.quadraticCurveTo(mx, my + er * 1.5, mx + er * 1.1, my - er * 0.3); c.closePath();
    c.fillStyle = "#5a1a14"; c.fill(); c.lineWidth = 1.6; c.stroke();
  } else if (style === "focused") {
    c.beginPath(); c.moveTo(mx - er * 0.7, my + er * 0.1); c.quadraticCurveTo(mx, my - er * 0.15, mx + er * 0.7, my + er * 0.1); c.lineWidth = 1.8; c.stroke();
  } else if (style === "cocky") {
    c.beginPath(); c.moveTo(mx - er * 1.05, my - er * 0.2); c.quadraticCurveTo(mx + er * 0.1, my + er * 1.25, mx + er * 1.35, my - er * 0.55);
    c.quadraticCurveTo(mx + er * 0.15, my + er * 0.3, mx - er * 1.05, my - er * 0.2); c.closePath();
    c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 1.6; c.stroke();
  } else if (style === "sly") {   // a closed smirk pulled up on the front side, with a dimple
    c.beginPath(); c.moveTo(mx - er * 1.05, my - er * 0.05); c.quadraticCurveTo(mx + er * 0.3, my + er * 0.8, mx + er * 1.45, my - er * 0.6); c.lineWidth = 2; c.stroke();
    c.lineWidth = 1.4; c.beginPath(); c.moveTo(mx + er * 1.3, my - er * 0.92); c.quadraticCurveTo(mx + er * 1.62, my - er * 0.66, mx + er * 1.55, my - er * 0.3); c.stroke();
  } else if (style === "fierce") {
    c.beginPath(); c.moveTo(mx - er * 1.0, my - er * 0.1); c.quadraticCurveTo(mx, my + er * 0.6, mx + er * 1.1, my - er * 0.5); c.lineWidth = 1.8; c.stroke();
    c.fillStyle = "#ffffff"; c.beginPath(); c.moveTo(mx + er * 0.25, my + er * 0.2); c.lineTo(mx + er * 0.4, my + er * 0.7); c.lineTo(mx + er * 0.58, my + er * 0.12); c.closePath(); c.fill(); c.lineWidth = 0.8; c.stroke();
  } else {
    c.beginPath(); c.arc(mx, my - er * 0.6, er * (style === "kind" ? 0.85 : 1.05), 0.35, Math.PI - 0.35); c.lineWidth = 1.8; c.stroke();
  }
}
function flameWing(c, ax, ay, ang, len, pal, dark) {
  for (let i = 4; i >= 0; i--) {
    const a = ang + (i - 2) * 0.27, L = len * (1 - Math.abs(i - 2) * 0.13);
    const ca = Math.cos(a), sa = Math.sin(a), tx = ax + ca * L, ty = ay + sa * L, nx = -sa, ny = ca, wd = len * 0.17;
    c.beginPath(); c.moveTo(ax, ay);
    c.quadraticCurveTo(ax + ca * L * 0.55 + nx * wd, ay + sa * L * 0.55 + ny * wd, tx, ty);
    c.quadraticCurveTo(ax + ca * L * 0.55 - nx * wd, ay + sa * L * 0.55 - ny * wd, ax, ay);
    const gr = c.createLinearGradient(ax, ay, tx, ty);
    gr.addColorStop(0, dark ? mix(pal.accent, "#000000", 0.25) : pal.accent); gr.addColorStop(1, mix(pal.accent, "#ffd27a", 0.6));
    c.fillStyle = gr; c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
  }
}
// Dragon (2D fallback): bat wing with finger bones, and a tapered tail behind
function batWing(c, ax, ay, ang, len, pal, dark, mirror) {
  c.save(); c.translate(ax, ay); c.rotate(ang); c.scale(len, len * (mirror ? -1 : 1));
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0.42, -0.44, 1, -0.42);
  c.quadraticCurveTo(0.86, -0.22, 0.72, -0.08); c.quadraticCurveTo(0.57, -0.13, 0.46, 0.02);
  c.quadraticCurveTo(0.31, -0.03, 0.2, 0.1); c.quadraticCurveTo(0.09, 0.02, 0, 0);
  c.fillStyle = dark ? mix(pal.accent, "#000000", 0.25) : pal.accent; c.fill();
  c.lineWidth = 2.2 / len; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = mix(pal.accent, "#2a1a14", 0.5); c.lineWidth = 1.6 / len;
  c.beginPath(); c.moveTo(0.5, -0.36); for (const [x, y] of [[0.72, -0.08], [0.46, 0.02], [0.2, 0.1]]) { c.moveTo(0.5, -0.36); c.lineTo(x, y); } c.stroke();
  c.restore();
}
function dragonTail(c, P, pal, tk, f) {
  const sw = Math.sin(tk * 0.07 + f.slot) * 3;
  let pts = [[-P.w * 0.2, P.hip[1] - 6], [-P.w * 0.75, P.hip[1] + 2], [-P.w * 1.15, -4 + sw * 0.3], [-P.w * 1.45 + sw, -7]];
  if (P.tailTo) {
    // Tail sweep: the tail follows P.tailTo (a bowed curve from the hip to the tip)
    const a = pts[0], t = P.tailTo, dx = t[0] - a[0], dy = t[1] - a[1], d = Math.hypot(dx, dy) || 1;
    let nx = -dy / d, ny = dx / d; if (ny > 0) { nx = -nx; ny = -ny; }
    const ctrl = [(a[0] + t[0]) / 2 + nx * d * 0.28, (a[1] + t[1]) / 2 + ny * d * 0.28];
    pts = qpts(a, ctrl, t, 3);
  }
  c.lineCap = "round";
  for (const [wd, col] of [[P.w * 0.3 + 3, OUT], [P.w * 0.3, pal.accent]]) {
    for (let i = 0; i < pts.length - 1; i++) {
      c.strokeStyle = col; c.lineWidth = Math.max(1.5, wd * (1 - i * 0.3));
      c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[i + 1][0], pts[i + 1][1]); c.stroke();
    }
  }
}
function capeShape(c, P, f, tk, color, long) {
  const w = P.w, sway = Math.sin(tk * 0.12 + f.slot) * 2 - clamp((f.vx + f.kbx) * f.facing * 0.8, -8, 8);
  const topY = P.cy - P.ry * (long ? 0.45 : 0.6), botY = P.hip[1] + (long ? 9 : 5);
  c.beginPath(); c.moveTo(w * 0.1, topY); c.lineTo(-w * 0.3, topY - 2);
  c.quadraticCurveTo(-w * 0.9 + sway, (topY + botY) / 2, -w * 0.82 + sway * 1.5, botY);
  c.lineTo(w * 0.05, botY - 2); c.closePath();
  c.fillStyle = color; c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
}
function ravenShape(c, x, y, s, flap, rdy) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.lineWidth = 1.4; c.strokeStyle = OUT;
  c.fillStyle = "#16151c"; c.beginPath(); c.moveTo(-6, 2); c.lineTo(-17, 8); c.lineTo(-15, 1); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, 0, 9, 6.5, -0.15, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.arc(7, -5, 4.6, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = "#3a3844"; c.beginPath(); c.moveTo(10.5, -6.5); c.lineTo(16.5, -4.5); c.lineTo(10.5, -3); c.closePath(); c.fill();
  c.fillStyle = rdy ? "#ff2a2a" : "#e33b3b"; c.beginPath(); c.arc(8, -6, rdy ? 2 : 1.2, 0, Math.PI * 2); c.fill();   // rdy: finish-ready, the eyes burn
  c.fillStyle = "#24232c"; c.beginPath(); c.ellipse(-2, -2 - flap * 4, 8, 4, -0.35 - flap, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
}
function odinFront(c, P, pal) {
  const { rx, ry, cy } = P, w = P.w, [hx, hy] = P.head, er = w * 0.1;
  c.save(); potatoPath(c, P); c.clip();
  c.fillStyle = "#26252e"; c.beginPath(); c.moveTo(-rx * 1.2, cy + ry * 0.22); c.quadraticCurveTo(0, cy + ry * 0.05, rx * 1.2, cy + ry * 0.22); c.lineTo(rx * 1.2, cy + ry * 1.3); c.lineTo(-rx * 1.2, cy + ry * 1.3); c.fill();
  c.strokeStyle = "#4a4958"; c.lineWidth = 1.4;
  for (const sx of [-0.45, 0.35]) { c.beginPath(); c.arc(sx * rx, cy + ry * 0.48, ry * 0.14, 0.4, 5.6); c.stroke(); }
  c.fillStyle = pal.accent; c.fillRect(-rx * 1.2, cy + ry * 0.66, rx * 2.4, ry * 0.14);
  c.fillStyle = "#f3efe6";
  c.beginPath(); c.moveTo(-rx * 1.3, P.top + ry * 1.1); c.lineTo(-rx * 1.3, P.top - 6); c.lineTo(rx * 1.3, P.top - 6); c.lineTo(rx * 1.3, P.top + ry * 0.3);
  c.quadraticCurveTo(rx * 0.1, P.top + ry * 0.5, -rx * 0.55, P.top + ry * 0.62); c.quadraticCurveTo(-rx * 0.8, P.top + ry * 0.9, -rx * 1.3, P.top + ry * 1.1); c.fill();
  c.restore();
  potatoPath(c, P); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
}
function odinBeard(c, P, pal) {
  const { rx, ry, cy } = P, w = P.w, [hx, hy] = P.head, er = w * 0.1;
  c.beginPath();
  c.moveTo(hx - w * 0.34, hy + er * 1.2);
  c.quadraticCurveTo(hx - w * 0.32, cy + ry * 0.72, hx - w * 0.02, cy + ry * 1.0);
  c.quadraticCurveTo(hx + w * 0.32, cy + ry * 0.72, hx + w * 0.37, hy + er * 1.2);
  c.quadraticCurveTo(hx + w * 0.2, hy + er * 2.3, hx + w * 0.02, hy + er * 1.95);
  c.quadraticCurveTo(hx - w * 0.17, hy + er * 2.3, hx - w * 0.34, hy + er * 1.2);
  c.fillStyle = "#f3efe6"; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = "#d6cfbf"; c.lineWidth = 1;
  for (const k of [-0.15, 0, 0.15]) { c.beginPath(); c.moveTo(hx + k * w, hy + er * 2.4); c.quadraticCurveTo(hx + k * w * 1.2, cy + ry * 0.55, hx + k * w * 0.4, cy + ry * 0.85); c.stroke(); }
  c.beginPath(); c.ellipse(hx + w * 0.02, hy + er * 1.3, er * 0.75, er * 0.65, 0, 0, Math.PI * 2);
  c.fillStyle = mix(pal.body, "#d0704a", 0.35); c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = "#f3efe6"; c.strokeStyle = OUT; c.lineWidth = 1;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(rx * 0.86 - i * 0.6, P.top + ry * 0.75 + i * ry * 0.2, 3.2, 3.8, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
}
function alchemistHood(c, P, pal) {
  const { rx, ry, cy } = P, w = P.w, [hx, hy] = P.head;
  c.save();
  c.beginPath(); c.rect(-rx * 1.6, cy - ry * 2.2, rx * 3.2, ry * 2.45); c.clip();
  c.beginPath();
  c.ellipse(-rx * 0.04, cy - ry * 0.16, rx * 1.12, ry * 1.0, 0, 0, Math.PI * 2);
  c.ellipse(hx + w * 0.01, hy + P.ry * 0.12, w * 0.36, ry * 0.52, 0, 0, Math.PI * 2);
  c.fillStyle = pal.accent; c.fill("evenodd"); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
  c.restore();
  c.strokeStyle = mix(pal.accent, "#000000", 0.35); c.lineWidth = 1.6;
  c.beginPath(); c.arc(hx, hy + ry * 0.12, w * 0.44, -2.75, -0.5); c.stroke();
  c.beginPath(); c.ellipse(0, cy + ry * 0.3, rx * 1.02, ry * 0.13, 0, 0, Math.PI * 2);
  c.fillStyle = mix(pal.accent, "#000000", 0.2); c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
  leaf(c, -w * 0.18, cy - ry * 1.12, 1, -0.6); leaf(c, w * 0.1, cy - ry * 1.15, 1, 0.5);
}
function wizardHat(c, P, pal, tk) {
  const { rx, ry } = P, by = P.top + ry * 0.22, sway = Math.sin(tk * 0.06) * 2;
  c.beginPath();
  c.moveTo(-rx * 0.75, by);
  c.quadraticCurveTo(-rx * 0.45, by - ry * 0.9, -rx * 0.25, by - ry * 1.35);
  c.quadraticCurveTo(-rx * 0.55 + sway, by - ry * 1.75, -rx * 1.05 + sway, by - ry * 1.55);
  c.quadraticCurveTo(-rx * 0.3, by - ry * 1.65, rx * 0.12, by - ry * 1.1);
  c.quadraticCurveTo(rx * 0.45, by - ry * 0.6, rx * 0.75, by);
  c.closePath();
  c.fillStyle = pal.accent; c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
  c.save(); c.clip(); c.fillStyle = mix(pal.accent, "#000000", 0.35); c.fillRect(-rx * 1.2, by - ry * 0.32, rx * 2.4, ry * 0.16); c.restore();
  c.beginPath(); c.ellipse(0, by, rx * 1.32, ry * 0.18, 0, 0, Math.PI * 2);
  c.fillStyle = mix(pal.accent, "#000000", 0.12); c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
  leaf(c, -rx * 0.3, by - ry * 0.62, 0.8, -0.4); leaf(c, rx * 0.2, by - ry * 0.4, 0.8, 0.6); leaf(c, -rx * 0.45, by - ry * 1.25, 0.75, 0.2);
}
function heldDir(f, P, shR, rest) {
  if (P.holdAng != null) return P.holdAng;   // a heavy look fixes the weapon angle (staff slam, sheathed katana ...)
  const m = f.state === "attack" && f.move;
  if (m && m.kind === "dash") return 0.05;
  if (m && (m.limb === "arm" || m.limb === "both")) return Math.atan2(P.hF[1] - shR[1], P.hF[0] - shR[0]);
  return rest;
}
function wizardStaff(c, P, f, shR, tk) {
  const a = heldDir(f, P, shR, -Math.PI / 2 + 0.12), dx = Math.cos(a), dy = Math.sin(a), [hx, hy] = P.hF;
  const b = [hx - dx * 34, hy - dy * 34], t = [hx + dx * 40, hy + dy * 40];
  c.lineCap = "round";
  c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(t[0], t[1]); c.stroke();
  c.strokeStyle = "#7a4a26"; c.lineWidth = 3.5; c.stroke();
  const fl = 1 + Math.sin(tk * 0.3) * 0.08, gf = fl * P.cryK, cf = fl * (1 + (P.cryK - 1) * 0.5);   // cryK: the crystal flares during heavy wind-ups
  const glow = c.createRadialGradient(t[0], t[1], 1, t[0], t[1], 16 * gf);
  glow.addColorStop(0, "rgba(255,226,140,0.85)"); glow.addColorStop(1, "rgba(255,200,90,0)");
  c.fillStyle = glow; c.beginPath(); c.arc(t[0], t[1], 16 * gf, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(t[0], t[1]); c.rotate(a + Math.PI / 2);
  c.beginPath(); c.moveTo(0, -11 * cf); c.lineTo(4.5 * cf, -2); c.lineTo(2.5 * cf, 4); c.lineTo(-2.5 * cf, 4); c.lineTo(-4.5 * cf, -2); c.closePath();
  c.fillStyle = "#ffd27a"; c.fill(); c.lineWidth = 1.4; c.strokeStyle = "#a8701c"; c.stroke();
  c.fillStyle = "#fff6d8"; c.beginPath(); c.moveTo(0, -7 * cf); c.lineTo(2 * cf, -1); c.lineTo(-2 * cf, -1); c.closePath(); c.fill();
  c.restore();
  P.staffTip = t;
}
function katana(c, P, f, shR, pal) {
  const a = heldDir(f, P, shR, -0.8), L = P.w * 1.35, sh = P.sheath;
  c.save(); c.translate(P.hF[0], P.hF[1]); c.rotate(a);
  c.lineCap = "round";
  c.strokeStyle = OUT; c.lineWidth = 5.5; c.beginPath(); c.moveTo(-9, 0); c.lineTo(2, 0); c.stroke();
  c.strokeStyle = "#3a2a22"; c.lineWidth = 3; c.stroke();
  if (sh > 0) {
    // Iaido: the blade rests in its scabbard (lacquer, gold mouth and tip) until the draw
    c.beginPath(); c.moveTo(4, -3.4); c.lineTo(L * 0.96, -2.8); c.lineTo(L * 0.96, 2.8); c.lineTo(4, 3.4); c.closePath();
    c.fillStyle = "#26232d"; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = "#c9a227"; c.fillRect(4, -3.6, 4, 7.2); c.beginPath(); c.arc(L * 0.96, 0, 3.2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.25)"; c.lineWidth = 1; c.beginPath(); c.moveTo(10, -1.6); c.lineTo(L * 0.9, -1.4); c.stroke();
  }
  const Lb = sh > 0 ? 4 + (L - 4) * (1 - sh) : L;
  if (Lb > 9) {
    c.beginPath(); c.moveTo(4, -1.8); c.quadraticCurveTo(Lb * 0.55, -3.6, Lb, -5.5); c.quadraticCurveTo(Lb * 0.55, 0.6, 4, 1.8); c.closePath();
    c.fillStyle = pal.accent; c.fill(); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 1; c.beginPath(); c.moveTo(7, -1); c.quadraticCurveTo(Lb * 0.55, -2.5, Lb - 4, -4.5); c.stroke();
  }
  c.beginPath(); c.ellipse(3, 0, 2.2, 5.2, 0, 0, Math.PI * 2); c.fillStyle = "#c9a227"; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  c.restore();
}
/* ---- Gunslinger: hat, neckerchief, vest, belt with holster, two revolvers ---- */
const GUN_GOLD = (f) => skinLvl(f) >= 3;   // the 200-chip skin carries gold pistols
// Twin Shot (and High Noon): both pistols come up from the hips and fire in turn, front one first; each shot kicks the hand up.
// High Noon (f.finShot) is one shot from the front hand only. set(hF, hB) hands the hands back to pose().
function gunShotPose(f, P, m, phase, k, w, leg, tor, set) {
  const iv = m.proj.interval || 1, n = f.finShot ? m.proj.finCount || 1 : m.proj.count || 1, sk = f.mt - m.startup;
  const kick = (i) => { const d = sk - i * iv; return i < n && d >= 1 && d < 6 ? 1 - (d - 1) / 5 : 0; };   // the barrel is level on the shot frame, the kick follows
  const up = phase === 0 ? ease(k) : phase === 2 ? 1 - ease(k) : 1;
  const hF = lerp2([w * 0.62, -leg - tor * 0.22], [w * 1.02, -leg - tor * 0.64], up);
  // Twin Shot: front pistol, then back. Dead Eye (Ultimate, six shots): they fire in turn, the last (the gold one) with a big flash
  const alt = n > 2;
  let kf = 0, kb = 0, sF = -1, sB = -1;
  for (let i = 0; i < n; i++) {
    const front = alt ? i % 2 === 0 : i === 0, d = sk - i * iv, kk = kick(i), fresh = d >= 0 && d < 3;
    if (front) { kf = Math.max(kf, kk); if (fresh) { sF = d; P.bigF = alt && !!m.ult && i === n - 1; } } else { kb = Math.max(kb, kk); if (fresh) { sB = d; P.bigB = alt && !!m.ult && i === n - 1; } }
  }
  const hB = f.finShot ? null : lerp2([-w * 0.5, -leg - tor * 0.25], [w * 0.8, -leg - tor * 0.76], up);
  set([hF[0] - kf * 4, hF[1] - kf * 5], hB && [hB[0] - kb * 4, hB[1] - kb * 5]);
  P.holdAng = lerp(0.9, -0.04, up) - kf * 0.55;
  if (hB) P.gunB = lerp(Math.PI - 0.9, -0.08, up) - kb * 0.55;
  P.lean = -0.06 * up - (kf + kb) * 0.05;
  if (sF >= 0) P.shotF = sF;
  if (sB >= 0 && !f.finShot) P.shotB = sB;
  P.ultShots = !!m.ult;
}
// a revolver in the hand at (hx, hy), pointing along a; the fist is drawn again over the grip. shot >= 0: the muzzle flash, frames since the shot
function gunHeld(c, f, P, hand, a, shot, r, limb, flash, back) {
  const [hx, hy] = hand, gold = GUN_GOLD(f), s = back ? 0.92 : 1;
  c.save(); c.translate(hx, hy); c.rotate(a); c.scale(s, s); c.lineJoin = "round"; c.lineCap = "round";
  const metal = flash ? "#ffffff" : gold ? "#e8b83e" : back ? "#555b66" : "#6f7682", dark = gold ? "#9c6c16" : "#30343c";
  c.lineWidth = 1.3; c.strokeStyle = OUT;
  c.beginPath(); c.moveTo(-3.5, -1); c.lineTo(1.5, -1); c.lineTo(-1.5, 8.5); c.lineTo(-6.5, 8); c.closePath();   // grip
  c.fillStyle = flash ? "#ffffff" : gold ? "#f3e4bf" : "#6e4529"; c.fill(); c.stroke();
  c.fillStyle = metal;
  c.beginPath(); c.roundRect(-4.5, -5, 9.5, 6.4, 1.6); c.fill(); c.stroke();                                    // frame and cylinder
  c.beginPath(); c.roundRect(4.2, -4.4, 13, 3.4, 1); c.fill(); c.stroke();                                       // barrel
  c.fillStyle = dark; c.fillRect(15, -6.1, 1.7, 1.9);                                                             // front sight
  c.beginPath(); c.moveTo(-4.2, -4.4); c.lineTo(-7.4, -7.2); c.lineTo(-3, -5); c.closePath(); c.fill();            // hammer
  c.lineWidth = 1; c.beginPath(); c.arc(1.8, 2.6, 2.3, 0, Math.PI); c.stroke();                                    // trigger guard
  c.strokeStyle = "rgba(255,255,255,0.6)"; c.beginPath(); c.moveTo(5.5, -3.7); c.lineTo(15.5, -3.7); c.stroke();
  if (shot >= 0) { const big = back ? P.bigB : P.bigF; gunFlash(c, 18.5, -2.7, shot, big ? 1.9 : f.finShot && !back ? 1.6 : P.ultShots ? 1.3 : 1, big || (f.finShot && !back)); }
  c.restore();
  c.fillStyle = limb; c.beginPath(); c.arc(hx, hy, r, 0, Math.PI * 2); c.fill();
  if (!back) { c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke(); }
}
// the muzzle flash, in the pistol's own frame (x along the barrel): a white core in a four-point star, k frames old
function gunFlash(c, x, y, k, s, gold) {
  const q = 1 - k / 3;
  if (q <= 0) return;
  c.save(); c.translate(x, y); c.scale(s * (0.7 + 0.5 * q), s * (0.7 + 0.5 * q));
  c.globalAlpha = q;
  c.fillStyle = gold ? "#ffcf3d" : "#ffb347";
  c.beginPath(); c.moveTo(-2, -5); c.lineTo(5, -2.5); c.lineTo(17, 0); c.lineTo(5, 2.5); c.lineTo(-2, 5); c.lineTo(1, 0); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(3, -9); c.lineTo(6, 0); c.lineTo(3, 9); c.lineTo(8, 0); c.closePath(); c.fill();
  c.fillStyle = gold ? "#fff6c8" : "#fff4d8"; c.beginPath(); c.ellipse(4, 0, 5, 2.6, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}
// neckerchief, leather vest, belt and the holster on the front hip, over the potato (inside the body's lean)
function gunOutfit(c, f, P, pal, flash) {
  const { rx, ry, cy } = P, hx = P.head[0], lvl = skinLvl(f);
  const vest = flash ? "#ffffff" : "#5b3a26", vestD = flash ? "#ffffff" : "#40281a", belt = flash ? "#ffffff" : "#3a2418";
  const kerch = flash ? "#ffffff" : col(pal), buckle = flash ? "#ffffff" : lvl === 2 ? "#dfe5ec" : "#e3b54a";
  c.save(); potatoPath(c, P); c.clip();
  // the vest: two leather panels open at the front
  c.fillStyle = vest;
  c.beginPath(); c.moveTo(-rx * 1.3, cy + ry * 0.26); c.lineTo(hx - rx * 0.5, cy + ry * 0.3); c.lineTo(hx - rx * 0.3, cy + ry * 1.2); c.lineTo(-rx * 1.3, cy + ry * 1.2); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(rx * 1.3, cy + ry * 0.24); c.lineTo(hx + rx * 0.42, cy + ry * 0.3); c.lineTo(hx + rx * 0.3, cy + ry * 1.2); c.lineTo(rx * 1.3, cy + ry * 1.2); c.closePath(); c.fill();
  c.strokeStyle = vestD; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(hx - rx * 0.5, cy + ry * 0.3); c.lineTo(hx - rx * 0.3, cy + ry * 1.2); c.moveTo(hx + rx * 0.42, cy + ry * 0.3); c.lineTo(hx + rx * 0.3, cy + ry * 1.2); c.stroke();
  // the belt
  c.fillStyle = belt; c.fillRect(-rx * 1.3, cy + ry * 0.68, rx * 2.6, ry * 0.15);
  c.restore();
  // buckle, holster on the front hip, neckerchief
  c.lineWidth = 1.2; c.strokeStyle = OUT;
  c.fillStyle = buckle; c.beginPath(); c.roundRect(hx - 4, cy + ry * 0.66, 8, ry * 0.19, 1.5); c.fill(); c.stroke();
  c.fillStyle = flash ? "#ffffff" : "#7a4a2a";
  c.beginPath(); c.moveTo(rx * 0.55, cy + ry * 0.72); c.lineTo(rx * 1.02, cy + ry * 0.72); c.lineTo(rx * 0.96, cy + ry * 1.12); c.quadraticCurveTo(rx * 0.78, cy + ry * 1.2, rx * 0.62, cy + ry * 1.1); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = "rgba(255,230,180,0.45)"; c.setLineDash([1.5, 2]); c.beginPath(); c.moveTo(rx * 0.62, cy + ry * 0.8); c.lineTo(rx * 0.68, cy + ry * 1.05); c.stroke(); c.setLineDash([]);
  if (lvl === 2 && !flash) star5(c, -rx * 0.55, cy + ry * 0.48, 4.2, "#dfe5ec");   // the Sheriff's badge
  c.fillStyle = kerch; c.strokeStyle = OUT; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(hx - rx * 0.62, cy + ry * 0.22); c.quadraticCurveTo(hx, cy + ry * 0.36, hx + rx * 0.58, cy + ry * 0.2); c.lineTo(hx + rx * 0.06, cy + ry * 0.72); c.closePath(); c.fill(); c.stroke();
  if (!flash) { c.fillStyle = "rgba(255,255,255,0.7)"; for (const [dx, dy] of [[-0.2, 0.33], [0.18, 0.31], [0, 0.5]]) { c.beginPath(); c.arc(hx + rx * dx, cy + ry * dy, 0.9, 0, Math.PI * 2); c.fill(); } }
}
function star5(c, x, y, r, colr) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = colr; c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke();
}
// the cowboy hat: a wide brim with the sides curled up, a dented crown with a band, the sprout poking through the top
function cowboyHat(c, P, pal) {
  const { rx, ry } = P, by = P.top + ry * 0.3, hat = pal.accent;
  c.save(); c.translate(rx * 0.08, by); c.rotate(-0.07);
  c.lineWidth = 2.2; c.strokeStyle = OUT;
  const brim = () => {
    c.beginPath();
    c.moveTo(-rx * 1.5, -ry * 0.36);
    c.quadraticCurveTo(-rx * 1.32, ry * 0.04, -rx * 0.7, ry * 0.08);
    c.quadraticCurveTo(0, ry * 0.2, rx * 0.75, ry * 0.08);
    c.quadraticCurveTo(rx * 1.38, ry * 0.04, rx * 1.58, -ry * 0.38);
    c.quadraticCurveTo(rx * 1.2, -ry * 0.12, rx * 0.7, -ry * 0.12);
    c.quadraticCurveTo(0, -ry * 0.04, -rx * 0.7, -ry * 0.12);
    c.quadraticCurveTo(-rx * 1.15, -ry * 0.12, -rx * 1.5, -ry * 0.36);
    c.closePath();
  };
  brim(); c.fillStyle = mix(hat, "#000000", 0.12); c.fill(); c.stroke();
  sprout(c, rx * 0.04, -ry * 0.7, 0.85);
  c.lineWidth = 2.2; c.strokeStyle = OUT;   // (sprout leaves its own green stroke behind)
  c.beginPath();
  c.moveTo(-rx * 0.66, -ry * 0.04);
  c.bezierCurveTo(-rx * 0.72, -ry * 0.5, -rx * 0.5, -ry * 0.84, -rx * 0.18, -ry * 0.8);
  c.quadraticCurveTo(rx * 0.02, -ry * 0.62, rx * 0.22, -ry * 0.8);
  c.bezierCurveTo(rx * 0.54, -ry * 0.84, rx * 0.76, -ry * 0.5, rx * 0.68, -ry * 0.04);
  c.closePath();
  c.fillStyle = hat; c.fill(); c.stroke();
  c.save(); c.clip();
  c.fillStyle = mix(hat, "#ffffff", 0.22); c.beginPath(); c.ellipse(-rx * 0.36, -ry * 0.52, rx * 0.13, ry * 0.17, -0.3, 0, Math.PI * 2); c.fill();   // a soft highlight
  c.fillStyle = mix(hat, "#000000", 0.45); c.fillRect(-rx, -ry * 0.27, rx * 2, ry * 0.15);                                                 // the band
  c.restore();
  // the front lip of the brim, over the crown's base
  c.beginPath(); c.moveTo(-rx * 0.86, ry * 0.07); c.quadraticCurveTo(0, ry * 0.2, rx * 0.88, ry * 0.07); c.quadraticCurveTo(0, ry * 0.02, -rx * 0.86, ry * 0.07); c.closePath();
  c.fillStyle = mix(hat, "#000000", 0.12); c.fill();
  c.beginPath(); c.moveTo(-rx * 0.7, ry * 0.08); c.quadraticCurveTo(0, ry * 0.2, rx * 0.75, ry * 0.08); c.stroke();
  c.restore();
}
/* ---- Reaper: a hood with sprouts poking out, a sly smirk, a farm scythe ---- */
// colours per skin: Shroud grey, Moss green, Ember Wake (dark hood, orange lining), Bone (white hood, black trim). P.dim greys them, a hit flash whitens them.
function reapCols(f, P, flash) {
  const lvl = skinLvl(f), ac = f.pal.accent;
  const c = {
    hood: ac, hoodD: mix(ac, "#000000", lvl === 3 ? 0.18 : 0.32), lining: f.pal.lining || (lvl === 2 ? "#f08a3c" : lvl === 3 ? "#1f1d26" : mix(ac, "#000000", 0.55)),   // a Road skin brings its own lining colour
    trim: lvl === 3 ? "#1f1d26" : null, ghost: lvl === 3 && !flash && !P.dim ? 1 : null, handle: lvl === 3 ? "#2a2630" : "#3b3530", band: lvl === 2 ? "#f08a3c" : "#7d7f88", blade: "#a7acb6", spine: "#6d717c",
  };
  if (flash) { for (const k in c) if (c[k]) c[k] = "#ffffff"; }
  else if (P.dim) { for (const k in c) if (c[k]) c[k] = mix(c[k], "#6a6a7a", 0.45); }
  return c;
}
// the hood: a soft peak that droops back, the back drape hanging over the shoulder, an open front framing the face (lining showing at the rim),
// two sprout leaves poking out at the top. Drawn over the face inside the body's lean.
function reaperHood(c, f, P, RC, tk) {
  const { rx, ry, cy, w } = P, [hx, hy] = P.head;
  const fl = f.state === "helpless" || (!f.grounded && f.state === "air") ? Math.sin(tk * 0.3 + f.slot) * 2.2 : 0, lift = clamp((f.vy || 0) * 0.5, -3, 4) * (f.grounded ? 0 : 1);
  const ox = hx + w * 0.005, oy = hy + ry * 0.1, orx = w * 0.375, ory = ry * 0.7;   // the face opening
  const outer = () => {
    c.beginPath();
    c.moveTo(rx * 1.1, cy + ry * 0.2);
    c.bezierCurveTo(rx * 1.18, cy - ry * 0.55, rx * 0.72, cy - ry * 1.12, rx * 0.02, cy - ry * 1.17);
    c.quadraticCurveTo(-rx * 0.62, cy - ry * 1.16 - lift, -rx * 0.98, cy - ry * 0.86 - lift * 0.6);   // the peak droops back
    c.quadraticCurveTo(-rx * 1.24 + fl * 0.3, cy - ry * 0.2, -rx * 1.2 + fl, cy + ry * 0.58 + fl * 0.4);   // the back drape over the shoulder
    c.quadraticCurveTo(-rx * 0.7, cy + ry * 0.7, -rx * 0.25, cy + ry * 0.52);
    c.quadraticCurveTo(rx * 0.5, cy + ry * 0.42, rx * 1.1, cy + ry * 0.2);
    c.closePath();
  };
  const hole = () => { c.beginPath(); c.ellipse(ox, oy, orx, ory, 0.08, 0, Math.PI * 2); };
  c.save();
  c.beginPath(); c.rect(-rx * 2, cy - ry * 2.2, rx * 4, ry * 3.6); c.ellipse(ox, oy, orx, ory, 0.08, 0, Math.PI * 2); c.clip("evenodd");
  outer(); c.fillStyle = RC.hood; c.fill();
  c.save(); c.clip();
  c.fillStyle = RC.hoodD;   // a fold shadow down the back and under the peak
  c.beginPath(); c.ellipse(-rx * 0.85, cy - ry * 0.1, rx * 0.32, ry * 0.9, 0.1, 0, Math.PI * 2); c.fill();
  c.strokeStyle = RC.hoodD; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-rx * 0.35, cy - ry * 1.0); c.quadraticCurveTo(-rx * 0.62, cy - ry * 0.4, -rx * 0.5, cy + ry * 0.4); c.stroke();
  if (RC.trim) { c.lineWidth = 5; c.strokeStyle = RC.trim; outer(); c.stroke(); }   // Bone: a black hem
  // the rim of the opening: a band of lining (the inside of the hood), then a crisp edge
  c.lineWidth = RC.trim ? 8 : 7; c.strokeStyle = RC.lining; hole(); c.stroke();
  c.lineWidth = 2.6; c.strokeStyle = OUT; hole(); c.stroke();
  c.restore();
  c.lineWidth = 2.2; c.strokeStyle = OUT; outer(); c.stroke();
  c.restore();
  sprout(c, rx * 0.05, cy - ry * 1.1, 1.05);
}
// the scythe in the front hand. Angle a points from the hand to the blade end of the handle; bladeS (+1 / -1, any value between flips it
// through a squash) puts the blade on one side of the handle; scyK < 1 foreshortens the handle (a flat swing seen from the side).
const SCY = { butt: 0.44, head: 1.02, blade: 0.98 };
function scyTipAt(h, a, s, w, k) {
  const L = w * SCY.head * (k == null ? 1 : k), lb = w * SCY.blade, x = L - lb * 0.28 * (k == null ? 1 : k), y = (s == null ? 1 : s) * lb, ca = Math.cos(a), sa = Math.sin(a);
  return [h[0] + x * ca - y * sa, h[1] + x * sa + y * ca];
}
const scyAng = (f, P) => (P.holdAng != null ? P.holdAng : f.state === "run" ? -2.05 : f.state === "ledge" ? 1.75 : f.state === "hitstun" ? -1.75 + P.spin : -1.75);
function scythe(c, f, P, RC, limb, lw) {
  const a = scyAng(f, P), s = P.bladeS, k = P.scyK, w = P.w, [hx, hy] = P.hF;
  const Lb = w * SCY.butt, Lh = w * SCY.head, lb = w * SCY.blade;
  c.save(); c.translate(hx, hy); c.rotate(a); c.lineCap = "round"; c.lineJoin = "round";
  c.save(); c.scale(k, 1);
  c.strokeStyle = OUT; c.lineWidth = 6.4; c.beginPath(); c.moveTo(-Lb, 0); c.lineTo(Lh, 0); c.stroke();
  c.strokeStyle = RC.handle; c.lineWidth = 3.6; c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.18)"; c.lineWidth = 1; c.beginPath(); c.moveTo(-Lb + 3, -0.9); c.lineTo(Lh - 6, -0.9); c.stroke();
  c.fillStyle = RC.handle; c.beginPath(); c.arc(-Lb, 0, 3.3, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.3; c.strokeStyle = OUT; c.stroke();   // the knob
  c.restore();
  c.translate(Lh * k, 0);
  c.fillStyle = RC.band; c.beginPath(); c.roundRect(-6, -3.6, 9, 7.2, 1.5); c.fill(); c.lineWidth = 1.3; c.strokeStyle = OUT; c.stroke();   // the collar
  if (Math.abs(s) > 0.06) {
    c.save(); c.scale(k * 0.5 + 0.5, s);
    c.beginPath(); c.moveTo(3, -3); c.quadraticCurveTo(lb * 0.58, lb * 0.3, -lb * 0.28, lb);       // the spine out to the tip
    c.quadraticCurveTo(lb * 0.16, lb * 0.44, -3, 3.5); c.closePath();                                // the cutting edge back to the collar
    c.fillStyle = RC.blade; c.fill(); c.lineWidth = 1.6 / Math.max(0.4, Math.abs(s)); c.strokeStyle = OUT; c.stroke();
    c.save(); c.clip(); c.fillStyle = RC.spine; c.beginPath(); c.moveTo(3, -3); c.quadraticCurveTo(lb * 0.58, lb * 0.3, -lb * 0.28, lb); c.quadraticCurveTo(lb * 0.42, lb * 0.32, 2, 2); c.closePath(); c.fill(); c.restore();
    if (RC.ghost) { c.save(); c.globalAlpha = 0.45; c.strokeStyle = "#c8ffe0"; c.lineWidth = 4 / Math.max(0.4, Math.abs(s)); c.beginPath(); c.moveTo(-1, 5); c.quadraticCurveTo(lb * 0.14, lb * 0.47, -lb * 0.24, lb * 0.93); c.stroke(); c.restore(); }   // 200 chips: a ghost-lit edge
    c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 1.2 / Math.max(0.4, Math.abs(s)); c.beginPath(); c.moveTo(-1, 5); c.quadraticCurveTo(lb * 0.14, lb * 0.47, -lb * 0.24, lb * 0.93); c.stroke();
    c.restore();
  }
  c.restore();
  P.scyTip = scyTipAt(P.hF, a, s, w, k);
  c.fillStyle = limb; c.beginPath(); c.arc(hx, hy, lw, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();   // the fist over the handle
}
// a swing trail: the blade tip's path as a pale crescent (tapered at both ends), cheap: one dark wash, the pale body, a white core
function scyTrail(c, pts, n, wmax, a) {
  if (a <= 0 || n < 2) return;
  c.globalAlpha = 0.35 * a; c.fillStyle = "rgba(20,15,30,0.9)"; brush(c, pts, wmax * 1.3 + 2, n);
  c.globalAlpha = 0.85 * a; c.fillStyle = "#e6e9f2"; brush(c, pts, wmax, n);
  c.globalAlpha = a; c.fillStyle = "#ffffff"; brush(c, pts, wmax * 0.38, n);
  c.globalAlpha = 1;
}
// the tip path of a swing: T = { h1, h2, a1, a2, s, k1, k2 } (hand, angle, blade side, foreshortening at the window's start and end); or T.flat = { cx, cy, rf, rb, ry, t1, t2 }
function scyPts(T, w, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    if (T.flat) { const F = T.flat, t = F.t1 + (F.t2 - F.t1) * u, ct = Math.cos(t); pts.push([F.cx + ct * (ct > 0 ? F.rf : F.rb), F.cy + Math.sin(t) * F.ry]); }
    else pts.push(scyTipAt(lerp2(T.h1, T.h2, u), T.a1 + (T.a2 - T.a1) * u, T.s, w, T.k1 == null ? 1 : T.k1 + ((T.k2 == null ? T.k1 : T.k2) - T.k1) * u));
  }
  return pts;
}
// the reach crescent while a ground heavy charges: thin, white, front and behind (Reap, grave sweep) or over the head (up heavy).
// It brightens and thickens with the charge; at full charge a star sits at each end.
function reapReach(c, f, P, tk) {
  const key = P.hv && P.hv.key, q = Math.min(1, P.chg / 40), full = P.chg > 40, pulse = 0.85 + 0.15 * Math.sin(tk * 0.45), th = (2 + 4 * q) * pulse;
  const w = P.w, leg = P.leg, tor = P.tor;
  // each arc: centre, radii, angle range. The flat swings lie on a flat ellipse (front and back reach differ); the up heavy is a half circle over his head
  const arcs = key === "hUp" ? [[0, -40, 76, 76, -Math.PI + 0.3, -0.3]]
    : key === "hDown" ? [[w * 0.2, -leg - tor * 0.05, 78, 7, -1.1, 1.1], [w * 0.2, -leg - tor * 0.05, 78, 7, Math.PI - 1.1, Math.PI + 1.1]]
    : [[w * 0.2, -leg - tor * 0.3, 94, 12, -1.1, 1.1], [w * 0.2, -leg - tor * 0.3, 68, 12, Math.PI - 1.1, Math.PI + 1.1]];
  c.save();
  for (const [cx, cy, rx, ry, a0, a1] of arcs) {
    const o = [], inn = [], flat = ry < rx;
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, an = a0 + (a1 - a0) * u, d = th * Math.sin(Math.PI * u), ca = Math.cos(an), sa = Math.sin(an);
      o.push([cx + ca * rx, cy + sa * ry]);
      inn.push(flat ? [cx + ca * (rx - d * 0.6), cy + sa * ry - d] : [cx + ca * (rx - d), cy + sa * (ry - d)]);
    }
    c.beginPath(); c.moveTo(o[0][0], o[0][1]); for (const p of o) c.lineTo(p[0], p[1]); for (let i = inn.length - 1; i >= 0; i--) c.lineTo(inn[i][0], inn[i][1]); c.closePath();
    c.globalAlpha = (0.3 + 0.55 * q) * pulse; c.fillStyle = "#ffffff"; c.fill();
    c.globalAlpha = 0.25 + 0.3 * q; c.strokeStyle = "rgba(20,15,30,0.6)"; c.lineWidth = 1; c.stroke();
    if (full) { c.globalAlpha = 1; const m = o[7]; star4(c, m[0], m[1], 5 + 2 * pulse, "#ffffff"); }   // full charge: a star at the far point of the reach
  }
  c.restore();
}
// Grave rise: a dark cloud under his feet that lifts him, swelling in the lift and thinning as he drifts
function graveCloud(c, f, P, tk, amt) {
  if (amt <= 0) return;
  const lvl = skinLvl(f), base = lvl === 2 ? "#3a2c2a" : lvl === 3 ? "#d9d4c6" : "#3a3646", rim = lvl === 2 ? "#f08a3c" : lvl === 3 ? "#9e9888" : "#6a6478";
  c.save();
  for (let i = 0; i < 6; i++) {
    const sx = (i - 2.5) * 9 + Math.sin(tk * 0.2 + i * 1.7) * 2, sy = 6 + Math.abs(i - 2.5) * -1.4 + Math.cos(tk * 0.17 + i) * 1.5, r = (8 + (i % 3) * 2.5) * amt;
    c.globalAlpha = 0.75 * amt; c.fillStyle = base; c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.5 * amt; c.strokeStyle = rim; c.lineWidth = 1.4; c.beginPath(); c.arc(sx, sy, r, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  }
  c.globalAlpha = 0.4 * amt; c.fillStyle = base;
  for (let i = 0; i < 3; i++) { const t = (tk * 0.05 + i / 3) % 1; c.beginPath(); c.arc((i - 1) * 10, 10 + t * 18, 4 * (1 - t) * amt + 1, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
// Reaper's lights, air moves, Harvest and Grave rise (the heavies are in HEAVY_LOOK.reaper): sets the scythe angle, blade side and
// foreshortening on P and hands the limbs back through set(hF, hB, fF, fB). Trails go in P.reapT (drawn by drawPotato).
const REAP_REST = (w, leg, tor) => [w * 0.9, -leg - tor * 0.32];
// the grip of the back hand, a little way down the handle from the front hand
const reapGrip = (h, a, k, d) => [h[0] - Math.cos(a) * d * k, h[1] - Math.sin(a) * d];
const REAP_MOVES = {
  // [wind hand, wind angle, wind side], [strike hand(s)], [strike angles], strike side, trail kind, two hands
  jab: { wh: [0.35, 0.25], wa: -3.0, ws: 1, sh: [[0.68, 0.22]], sa: [-3.2], ss: 1, tr: "butt", two: true },
  side: { wh: [0.12, 0.25], wa: -0.2, ws: -1, sh: [[0.66, 0.2]], sa: [0.02], ss: -1, tr: "head", two: true },
  up: { wh: [0.55, 0.35], wa: -0.3, ws: -1, sh: [[0.4, 0.95], [0.0, 1.0]], sa: [-0.9, -2.7], ss: -1, tr: "tip", two: true },
  down: { wh: [0.3, 0.25], wa: -0.1, ws: -1, sh: [[0.6, 0.12]], sa: [0.1], ss: -1, tr: "head", two: true, crouch: 0.38 },
  nair: { wh: [0.45, 0.45], wa: -2.6, ws: 1, sh: [[0.45, 0.42]], sa: [-1.9, -1.9 + Math.PI * 2], ss: 1, tr: "tip", span: 0.55 },
  sair: { wh: [0.4, 0.95], wa: -2.5, ws: 1, sh: [[0.72, 0.8], [0.8, 0.38]], sa: [-1.4, 0.6], ss: 1, tr: "tip", two: true },
  uair: { wh: [0.45, 0.5], wa: -0.4, ws: -1, sh: [[0.3, 1.05], [-0.05, 1.05]], sa: [-0.8, -2.6], ss: -1, tr: "tip", two: true },
  dair: { wh: [0.25, 1.0], wa: -1.5, ws: 1, sh: [[0.4, 0.45], [0.25, 0.25]], sa: [-0.4, 1.75], ss: 1, tr: "tip", two: true },
  pound: { wh: [0.6, 0.6], wa: 1.57, ws: 1, sh: [[0.6, 0.6]], sa: [1.57], ss: 1, tr: null, two: true },
};
function reaperPose(f, P, m, mid, phase, k, w, leg, tor, set) {
  const a0 = m.startup + 1, a1 = m.startup + m.active, u = phase === 1 ? (m.active > 1 ? clamp((f.mt - a0) / (m.active - 1), 0, 1) : 1) : phase === 2 ? 1 : 0;
  const rest = REAP_REST(w, leg, tor), tl = (r, wd, s1, s2) => (phase === 0 ? mixv(r, wd, ease(k)) : phase === 1 ? mixv(s1, s2 == null ? s1 : s2, u) : mixv(s2 == null ? s1 : s2, r, ease(k)));
  const fade = phase === 2 ? 1 - (f.mt - a1) / 7 : 1;
  P.noSwoosh = true; P.spin = 0;
  if (mid === "spec") {
    // Harvest: the scythe is drawn back, then spins flat round him one and a half times as he slides; Last Rites hooks up at the end
    const cx = w * 0.25, cy = -leg - tor * 0.26;
    P.lean = phase === 1 ? 0.12 : phase === 0 ? -0.12 * ease(k) : 0.12 * (1 - ease(k));
    P.crouch = phase === 2 ? 0.25 * (1 - ease(k)) : 0.25;
    let hF, ps = Math.PI - 0.1 + Math.PI * 3 * u;
    if (phase === 0) { hF = lerp2(rest, [w * 0.05, cy], ease(k)); P.holdAng = mixv(-1.75 + Math.PI * 2, Math.PI - 0.1, ease(k)); P.bladeS = 1 - 1.5 * ease(k); P.scyBack = k > 0.5; }
    else if (phase === 1) {
      const cp = Math.cos(ps);
      hF = [cx + cp * w * 0.22, cy + Math.sin(ps) * 3]; P.holdAng = cp >= 0 ? 0.04 : Math.PI - 0.04; P.scyK = Math.max(0.12, Math.abs(cp)); P.bladeS = -0.5; P.scyBack = Math.sin(ps) < 0;
      P.reapT = { T: { flat: { cx, cy, rf: 66, rb: 54, ry: 11, t1: ps - 2.4, t2: ps } }, n: 1, a: 1, wmax: 9 };
    } else {
      const fin = typeof finishReady === "function" && finishReady(foeSlot(f.slot));
      hF = lerp2([cx + w * 0.22, cy], rest, ease(k)); P.holdAng = mixv(fin ? -1.4 : 0.04, -1.75, ease(k)); P.bladeS = mixv(fin ? -1 : -0.5, 1, ease(k));
      if (fin && f.mt - a1 < 9) P.reapT = { T: { h1: [w * 0.6, -leg - tor * 0.2], h2: [w * 0.3, -leg - tor * 1.0], a1: 0.4, a2: -1.6, s: -1 }, n: 1, a: 1 - (f.mt - a1) / 9, wmax: 12 };   // Last Rites: the hook straight up
    }
    set(hF, reapGrip(hF, P.holdAng, P.scyK, 13), [w * 0.42, 0], [-w * 0.38, 0]);
    return;
  }
  if (mid === "ulti") {
    // Soul Harvest: the scythe raised in the freeze; the hook out at arm's length, tugging (frames 4 to 23); then one big sweep up and over
    const mt = f.mt, fz = ease(uvFz(f)), raise = [w * 0.6, -leg - tor * 1.08], hook = [w * 1.0, -leg - tor * 0.62], lo = [w * 0.55, -leg - tor * 0.3], hi = [w * 0.12, -leg - tor * 1.05];
    P.bladeS = 1;
    if (mt === 0) { P.holdAng = -1.75; P.lean = -0.1 * fz; P.crouch = 0.2 * fz; set(lerp2(rest, raise, fz), [-w * 0.5, -leg - tor * 0.75], [w * 0.42, 0], [-w * 0.38, 0]); }
    else if (mt <= 24) {
      const q = ease(clamp(mt / 4, 0, 1)), tug = mt >= 4 ? Math.max(0, Math.sin((mt - 4) * 0.62)) : 0, hF = lerp2(raise, [hook[0] - tug * 7, hook[1]], q);
      P.holdAng = lerp(-1.75, 0.12 - tug * 0.12, q); P.lean = -0.1 - 0.12 * q - 0.06 * tug; P.crouch = 0.2 + 0.12 * q;
      set(hF, reapGrip(hF, P.holdAng, 1, 14), [w * 0.55, 0], [-w * 0.5, 0]);
    } else if (mt <= 31) {
      const u = clamp((mt - 25) / 6, 0, 1), e = ease(u), u0 = ease(Math.max(0, u - 0.45)), hF = lerp2(lo, hi, e);
      P.holdAng = lerp(0.5, -2.9, e); P.lean = lerp(-0.2, 0.18, e); P.crouch = 0.32 * (1 - e);
      P.reapT = { T: { h1: lerp2(lo, hi, u0), h2: hF, a1: lerp(0.5, -2.9, u0), a2: P.holdAng, s: 1 }, n: 1, a: 1, wmax: 11 };
      set(hF, reapGrip(hF, P.holdAng, 1, 14), [w * 0.5, 0], [-w * 0.45, 0]);
    } else {
      const r = ease(clamp((mt - 31) / 36, 0, 1)), a = 1 - (mt - 31) / 7, hF = lerp2(hi, rest, r);
      P.holdAng = lerp(-2.9, -1.75, r); P.lean = 0.18 * (1 - r); P.crouch = 0.1 * (1 - r);
      if (a > 0) P.reapT = { T: { h1: lerp2(lo, hi, 0.55), h2: hi, a1: lerp(0.5, -2.9, 0.55), a2: -2.9, s: 1 }, n: 1, a, wmax: 11 };
      set(hF, reapGrip(hF, P.holdAng, 1, 14), [w * 0.4, 0], [-w * 0.36, 0]);
    }
    return;
  }
  if (m.rec) {
    // Grave rise: both arms up, the scythe raised, a dark cloud under the feet lifts him
    P.holdAng = -1.75; P.bladeS = 1; P.lean = -0.05;
    P.cloud = phase === 0 ? ease(k) : phase === 1 ? 1 : 1 - 0.7 * ease(k);
    set([w * 0.6, -leg - tor * 1.08], [-w * 0.5, -leg - tor * 0.75], [w * 0.14, -leg * 0.3], [-w * 0.12, -leg * 0.2]);
    return;
  }
  const R = REAP_MOVES[mid];
  if (!R) return;
  const pt = (q) => [w * q[0], -leg - tor * q[1]];
  const sh1 = pt(R.sh[0]), sh2 = R.sh[1] ? pt(R.sh[1]) : sh1, sa1 = R.sa[0], sa2 = R.sa[1] == null ? sa1 : R.sa[1];
  const restA = -1.75;   // the scythe at rest
  const hF = tl(rest, pt(R.wh), sh1, sh2);
  P.holdAng = tl(restA, R.wa, sa1, sa2); P.bladeS = tl(1, R.ws, R.ss, R.ss);
  if (R.crouch) P.crouch = Math.max(P.crouch, R.crouch * (phase === 2 ? 1 - ease(k) : phase === 0 ? ease(k) : 1));
  if (mid === "pound") { P.holdAng = 1.57; P.bladeS = 1; }
  if (R.tr && phase > 0 && fade > 0) {
    const u0 = R.span ? Math.max(0, u - R.span) : 0;
    P.reapT = { T: { h1: lerp2(sh1, sh2, u0), h2: lerp2(sh1, sh2, Math.max(u, u0 + 0.12)), a1: sa1 + (sa2 - sa1) * u0, a2: sa1 + (sa2 - sa1) * Math.max(u, u0 + 0.12), s: R.ss, pt: R.tr, wh: pt(R.wh), wa: R.wa }, n: 1, a: fade, wmax: R.tr === "tip" ? 9 : 6 };
  }
  set(hF, R.two ? reapGrip(hF, P.holdAng, 1, 14) : null, null, null);
}
// the trail of a light: the tip's arc, or a thrust streak behind the poking end (butt or handle head)
function reapLightTrail(c, f, P) {
  const R = P.reapT;
  if (!R) return;
  let pts;
  if (R.T.pt === "butt" || R.T.pt === "head") {
    const d = R.T.pt === "butt" ? -P.w * SCY.butt : P.w * SCY.head, e = (h, a) => [h[0] + Math.cos(a) * d, h[1] + Math.sin(a) * d];
    pts = lpts(e(R.T.wh, R.T.wa), e(P.hF, P.holdAng), 8);
  } else pts = scyPts(R.T, P.w, 14);
  scyTrail(c, pts, pts.length - 1, R.wmax, R.a * 0.9);
}
function greenOrb(c, x, y, r, tk) {
  const fl = 1 + Math.sin(tk * 0.25) * 0.08;
  const glow = c.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4 * fl);
  glow.addColorStop(0, "rgba(140,255,120,0.55)"); glow.addColorStop(1, "rgba(80,255,90,0)");
  c.fillStyle = glow; c.beginPath(); c.arc(x, y, r * 2.4 * fl, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, "#eaffd8"); g.addColorStop(0.45, "#7dff62"); g.addColorStop(1, "#2fbf3a");
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.5; c.strokeStyle = "#1d6b26"; c.stroke();
}
function drawZap(c, from, S, tk, alt) {
  const [x0, y0] = from, x1 = S.tx, y1 = S.ty, n = 7;
  const pts = [[x0, y0]];
  for (let i = 1; i < n; i++) {
    const t = i / n, j = ((Math.sin(tk * 1.7 + i * 12.9) * 43758.5) % 1) * 2 - 1;
    pts.push([x0 + (x1 - x0) * t + j * 7, y0 + (y1 - y0) * t + j * 9]);
  }
  pts.push([x1, y1]);
  for (const [col, wd] of [["rgba(160,255,140,0.45)", 9], ["#d9ffcf", 3.5], ["#ffffff", 1.5]]) {
    c.strokeStyle = col; c.lineWidth = wd; c.lineJoin = "round"; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.stroke();
  }
  c.fillStyle = "rgba(200,255,190,0.55)"; c.beginPath(); c.arc(x1, y1, S.r * 0.7, 0, Math.PI * 2); c.fill();
  if (alt) {
    c.strokeStyle = alt; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0);
    for (let i = 1; i < n; i++) { const t = i / n, j = ((Math.sin(tk * 2.3 + i * 7.1) * 43758.5) % 1) * 2 - 1; c.lineTo(x0 + (x1 - x0) * t + j * 9, y0 + (y1 - y0) * t + j * 11); }
    c.lineTo(x1, y1); c.stroke();
  }
}
function drawMagic(c, from, S, tk) {
  const len = Math.hypot(S.tx - from[0], S.ty - from[1]) + S.r, ang = Math.atan2(S.ty - from[1], S.tx - from[0]);
  const fl = Math.sin(tk * 1.1) * 3;
  c.save(); c.translate(from[0], from[1]); c.rotate(ang);
  const gr = c.createLinearGradient(0, 0, len, 0);
  gr.addColorStop(0, "#fffbe6"); gr.addColorStop(0.35, "#ffe08a"); gr.addColorStop(0.75, "#7fe3ff"); gr.addColorStop(1, "rgba(120,220,255,0)");
  c.fillStyle = gr;
  c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(len * 0.5, -(S.r + fl), len, -S.r * 0.3); c.lineTo(len, S.r * 0.3); c.quadraticCurveTo(len * 0.5, S.r + fl, 0, 3); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,0.8)";
  if (S.hv) {
    // a heavy sweep leaves three star motes behind
    for (let i = 1; i <= 3; i++) star4(c, len * (0.28 + i * 0.2), Math.sin(tk * 0.4 + i * 2) * S.r * 0.55, 6.5 - i * 0.6, i % 2 ? "#fff6d8" : "#bff3ff");
  } else for (let i = 1; i <= 3; i++) { const t = ((tk * 0.07 + i / 3) % 1) * len; c.beginPath(); c.arc(t, Math.sin(tk * 0.4 + i) * S.r * 0.4, 2, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
function drawPotato(c, f, tk, at) {
  const ox = at ? at[0] : f.x, oy = at ? at[1] : f.y;
  const look = f.spec.look, pal0 = f.pal, cos = look.costume;
  const P = pose(f, tk);
  let alpha = 1;
  if (intangible(f) && f.state !== "respawn" && f.state !== "getup") alpha = (tk >> 2) % 2 ? 0.55 : 0.8;
  if (f.state === "dodge" && f.st >= 3 && f.st <= (f.dodgeKind === "air" ? 20 : 16)) alpha = 0.45;
  if (uvHeld(f)) alpha = uvAlpha(f);   // an ulti: solid (no intangible flicker), the Samurai's dash ghosted
  const flash = f.flash > 0 && f.flash % 2 === 0;
  const pal = flash ? { body: "#ffffff", trim: "#ffffff", accent: "#ffffff" } : P.dim ? { body: mix(pal0.body, "#6a6a7a", 0.45), trim: pal0.trim, accent: mix(pal0.accent, "#6a6a7a", 0.45) } : pal0;
  const limbF = flash ? "#ffffff" : LIMB, limbB = flash ? "#e8e8f0" : LIMB_BACK;
  const RC = cos === "reaper" ? reapCols(f, P, flash) : null;
  c.save();
  c.translate(ox + P.jit[0], oy - P.hop + P.jit[1]); c.globalAlpha = alpha; const us = uvScale(f); c.scale(f.facing * us, us);
  if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(P.spin); c.translate(0, P.h * 0.5); }
  c.lineCap = "round"; c.lineJoin = "round";
  const lw = look.limbW, legLen = Math.max(P.leg * 1.25, 12), armLen = P.tor * 0.85;
  const shR = rot(P.sh, P.hip, P.lean), shB = rot(P.shB, P.hip, P.lean);
  if (TEAM_RIM && !at) teamRimBody(c, f, P);   // 2v2: the team-colour outline behind the body (draw-world.js)
  if (cos === "phoenix") {
    const air = !f.grounded && f.state !== "ledge";
    const len = P.w * (air ? 1.35 : 1.0);
    const a1 = rot([-P.w * 0.2, P.cy - P.ry * 0.2], P.hip, P.lean), a2 = rot([P.w * 0.05, P.cy - P.ry * 0.3], P.hip, P.lean);
    const fl = P.flap + P.wingUp * 0.9;
    flameWing(c, a1[0], a1[1], (air ? -2.7 : -2.4) + fl + P.lean, len, pal, true);
    flameWing(c, a2[0], a2[1], (air ? -0.75 : -1.2) - fl * 0.7 + P.lean, len * 0.9, pal, false);
  }
  if (cos === "dragon") {
    dragonTail(c, P, pal, tk, f);
    const air = !f.grounded && f.state !== "ledge", len = P.w * (air ? 1.1 : 0.95);
    const a1 = rot([-P.w * 0.3, P.cy + P.ry * 0.1], P.hip, P.lean), a2 = rot([P.w * 0.2, P.cy + P.ry * 0.05], P.hip, P.lean);
    const fl = P.flap - P.wingUp * 0.9;
    batWing(c, a1[0], a1[1], Math.PI + 0.18 - fl + P.lean, len, pal, true, true);
    batWing(c, a2[0], a2[1], -0.25 + fl * 0.7 + P.lean, len * 0.9, pal, false, false);
  }
  if (cos === "alchemist") capeShape(c, P, f, tk, mix(pal.accent, "#000000", 0.15), false);
  if (cos === "odin") capeShape(c, P, f, tk, pal.accent, true);
  if (cos === "reaper") { graveCloud(c, f, P, tk, P.cloud); if (P.scyBack) scythe(c, f, P, RC, limbF, lw * 0.95); }
  limbPath(c, P.hipB, P.fB, legLen, "fwd", lw, limbB);
  c.fillStyle = limbB; c.beginPath(); c.ellipse(P.fB[0] + 2, P.fB[1] - 1, 5, 3, 0, 0, Math.PI * 2); c.fill();
  limbPath(c, shB, P.hB, armLen, "down", lw - 0.5, limbB);
  c.fillStyle = limbB; c.beginPath(); c.arc(P.hB[0], P.hB[1], lw * (look.fist ? 1 : 0.85), 0, Math.PI * 2); c.fill();
  if (cos === "gunslinger") gunHeld(c, f, P, P.hB, P.gunB != null ? P.gunB : Math.PI + 0.35, P.shotB, lw * 0.85, limbB, flash, true);
  limbPath(c, P.hipF, P.fF, legLen, "fwd", lw, limbF);
  c.fillStyle = limbF; c.beginPath(); c.ellipse(P.fF[0] + 2, P.fF[1] - 1, 5.5, 3.2, 0, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
  potatoBody(c, P, pal);
  if (cos === "odin") odinFront(c, P, pal);
  if (cos === "samurai") {
    c.save(); potatoPath(c, P); c.clip();
    c.fillStyle = "#24222c"; c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.42, P.rx * 2.6, P.ry);
    c.fillStyle = "#c8352b"; c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.62, P.rx * 2.6, 1.6); c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.82, P.rx * 2.6, 1.6);
    c.fillStyle = "#2a2833"; c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.3, P.rx * 2.6, P.ry * 0.17);
    c.fillStyle = "#c8352b"; c.fillRect(-P.rx * 1.3, P.cy - P.ry * 0.62, P.rx * 2.6, P.ry * 0.13);
    c.restore();
    c.fillStyle = "#c8352b"; c.beginPath(); c.ellipse(-P.rx * 0.98, P.cy - P.ry * 0.56, 2.6, 2.4, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(-P.rx * 1.12, P.cy - P.ry * 0.42, 1.5, 4.5, 0.7, 0, Math.PI * 2); c.fill();
  }
  if (cos === "wizard") {
    c.save(); potatoPath(c, P); c.clip();
    c.fillStyle = mix(pal.accent, "#000000", 0.25); c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.45, P.rx * 2.6, P.ry);
    c.fillStyle = "#d8b04a"; c.fillRect(-P.rx * 1.3, P.cy + P.ry * 0.45, P.rx * 2.6, 1.8);
    c.restore();
  }
  if (cos === "gunslinger") gunOutfit(c, f, P, pal, flash);
  if (cos === "dragon") {
    c.fillStyle = mix(pal.body, "#fff0c6", 0.45); c.beginPath(); c.ellipse(P.rx * 0.18, P.cy + P.ry * 0.55, P.rx * 0.55, P.ry * 0.32, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = mix(pal.body, "#7a4a22", 0.4); c.lineWidth = 1.2;
    for (const t of [-0.3, 0, 0.3]) { const yy = P.cy + P.ry * (0.55 + t * 0.6), hw2 = P.rx * 0.5 * Math.sqrt(1 - t * t * 1.6); c.beginPath(); c.moveTo(P.rx * 0.18 - hw2, yy); c.lineTo(P.rx * 0.18 + hw2, yy); c.stroke(); }
  }
  roadSkinBody(c, f, P, tk, flash);
  potatoFace(c, f, P, look);
  if (cos === "odin") odinBeard(c, P, pal);
  if (cos === "alchemist") {
    alchemistHood(c, P, pal);
    const [gx, gy] = P.head, er = P.w * 0.1;
    for (const dx of [-1.25, 1.2]) { c.fillStyle = "#b8863b"; c.beginPath(); c.arc(gx + dx * er, gy - er * 3.1, er * 0.75, 0, Math.PI * 2); c.fill(); c.fillStyle = "#8fe8d2"; c.beginPath(); c.arc(gx + dx * er, gy - er * 3.1, er * 0.5, 0, Math.PI * 2); c.fill(); }
  }
  if (cos === "wizard") wizardHat(c, P, pal, tk);
  if (cos === "gunslinger") cowboyHat(c, P, pal);
  if (cos === "reaper") reaperHood(c, f, P, RC, tk);
  if (cos === "phoenix") for (const a of [-2.2, -1.75, -1.3]) flameWing(c, -P.w * 0.12, P.top + P.ry * 0.2, a, P.w * 0.42, pal, false);
  if (cos === "dragon") {
    c.fillStyle = "#efe3c8"; c.strokeStyle = OUT; c.lineWidth = 1.2;
    for (const x0 of [-P.w * 0.2, P.w * 0.12]) { c.beginPath(); c.moveTo(x0 - 3.5, P.top + 5); c.quadraticCurveTo(x0 - 3, P.top - 8, x0 - 9, P.top - 15); c.quadraticCurveTo(x0 + 1, P.top - 6, x0 + 3.5, P.top + 4); c.closePath(); c.fill(); c.stroke(); }
  }
  if (cos === "samurai") { c.fillStyle = "#1c1714"; c.beginPath(); c.ellipse(-P.w * 0.04, P.top - 2, 5.5, 4.5, 0, 0, Math.PI * 2); c.fill(); sprout(c, -P.w * 0.04, P.top - 5, 0.85); }
  if (cos === "phoenix" || cos === "dragon") sprout(c, -P.w * 0.04, P.top + 1, 1);
  if (cos === "odin") sprout(c, P.w * 0.06, P.top - 3, 0.9);
  roadSkinTop(c, f, P, tk, flash);
  c.restore();
  if (cos === "odin" && !f._ravenOut) {
    let p = rot([-P.w * 0.38, P.top + P.ry * 0.62], P.hip, P.lean);
    if (P.ravenTo && P.ravenK > 0) p = lerp2(p, P.ravenTo, P.ravenK);   // Raven rise: it lifts off with the fist
    ravenShape(c, p[0], p[1], 0.85, P.ravenK > 0.3 ? Math.sin(tk * 1.1) * 0.8 : Math.sin(tk * 0.08) > 0.95 ? 0.4 : 0);
  }
  limbPath(c, shR, P.hF, armLen, "down", lw, limbF);
  c.fillStyle = limbF; c.beginPath(); c.arc(P.hF[0], P.hF[1], lw * (look.fist ? 1.15 : 0.95), 0, Math.PI * 2); c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  if (f.mid === "ulti" && f.state === "attack") uvHeldProp(c, f, P, tk);
  if (cos === "wizard") wizardStaff(c, P, f, shR, tk);
  if (cos === "samurai") katana(c, P, f, shR, pal);
  if (cos === "gunslinger") gunHeld(c, f, P, P.hF, heldDir(f, P, shR, -0.3), P.shotF, lw * 0.95, limbF, flash, false);
  if (cos === "reaper") { if (!P.scyBack) scythe(c, f, P, RC, limbF, lw * 0.95); reapLightTrail(c, f, P); }
  if (cos === "alchemist" && f.specCd <= 0 && !flash && f.mid !== "ulti") greenOrb(c, P.hF[0] + 2, P.hF[1] - 4, P.w * 0.15, tk);
  if (f.armorFlash > 0 || (BL.armored(f) && tk % 6 < 3)) {
    c.strokeStyle = "rgba(255,240,200,0.8)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -P.h * 0.5, P.w * 0.9, P.h * 0.62, 0, 0, Math.PI * 2); c.stroke();
  }
  drawSwooshes(c, f, P, tk, alpha);
  if (f.move && f.move.shot && f.state === "attack") drawGunLightFx(c, f, P, tk);   // the Gunslinger's light shots: the tracer along the hitbox path
  drawHeavyFx(c, f, P, tk);
  drawFinishFx(c, f, P, tk);
  c.restore();
  if (!at) drawHx(c, f.slot);
}
// The classic slash / flame / zap / magic swoosh for the move being played
function drawSwooshes(c, f, P, tk, alpha) {
  if (!P.swoosh || P.swoosh.linger) return;
  const S = P.swoosh, m = f.move, pal0 = f.pal;
  c.globalAlpha = alpha * (S.heavy ? 0.75 : 0.55);
  c.strokeStyle = pal0.accent; c.lineCap = "round";
  if (S.fire) { c.globalAlpha = alpha; drawFlame(c, P, S, tk); }
  else if (m && m.zap) { c.globalAlpha = alpha; drawZap(c, [P.hF[0], P.hF[1] - 4], S, tk, skinLvl(f) >= 3 ? pal0.accent : null); }
  else if (m && m.magic) { c.globalAlpha = alpha * 0.95; drawMagic(c, P.staffTip || P.hF, S, tk); }
  else drawSwoosh(c, f, P, S);
}
// Slash arcs. Samurai skins from 120 chips get an ink-brush underlay with the same shape and size.
function drawSwoosh(c, f, P, S) {
  const ink = f.spec.look.costume === "samurai" && skinLvl(f) >= 2 && !S.body;
  const path = () => {
    c.beginPath();
    if (S.body) c.arc(0, -P.h * 0.5, S.r + 4, P.spin - 2.2, P.spin + 0.4);
    else if (S.sweep) { c.moveTo(S.sx, S.sy); c.quadraticCurveTo((S.sx + S.tx) / 2, Math.min(S.sy, S.ty) - S.r * 0.8, S.tx, S.ty); }
    else c.arc(S.tx - S.r * 0.45, S.ty, S.r * 0.95, -1.15, 1.15);
  };
  const lw = S.body ? 5 : S.sweep ? S.r * 0.6 : S.r * (S.heavy ? 0.5 : 0.35);
  if (S.hv && !S.body) {
    // heavies: dark edge, accent core, white hairline (a charged heavy: thicker, with a light second tone round it)
    const ga = c.globalAlpha, ck = S.ck || 0, lw0 = lw;
    const lwk = lw0 * (1 + 0.7 * ck);
    if (ck > 0.04) { c.globalAlpha = ga * 0.6; c.strokeStyle = mix(f.pal.accent, "#ffffff", 0.6); c.lineWidth = lwk * 1.3 + 4 + 5 * ck; path(); c.stroke(); }
    c.globalAlpha = ga; c.strokeStyle = "rgba(20,15,30,0.85)"; c.lineWidth = lwk * 1.3; path(); c.stroke();
    c.strokeStyle = f.pal.accent; c.lineWidth = lwk * 0.62; path(); c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = Math.max(1.2, lwk * 0.14); path(); c.stroke();
    return;
  }
  if (ink) {
    const ga = c.globalAlpha;
    c.globalAlpha = ga * 0.8; c.strokeStyle = "rgba(20,15,30,0.85)"; c.lineWidth = lw; path(); c.stroke();
    c.globalAlpha = ga; c.strokeStyle = f.pal.accent; c.lineWidth = lw * 0.45; path(); c.stroke();
    c.strokeStyle = "rgba(20,15,30,0.5)"; c.lineWidth = 1.2; c.setLineDash([2, 5]); path(); c.stroke(); c.setLineDash([]);
    return;
  }
  c.lineWidth = lw; path(); c.stroke();
}

function drawFighter0(c, f, tk, at) {
  if (f.spec.look.build === "potato") return drawPotato(c, f, tk, at);
  const ox = at ? at[0] : f.x, oy = at ? at[1] : f.y;
  const look = f.spec.look, pal0 = f.pal, X = px(pal0);
  const P = pose(f, tk);
  let alpha = 1;
  if (intangible(f) && f.state !== "respawn" && f.state !== "getup") alpha = (tk >> 2) % 2 ? 0.55 : 0.8;
  if (f.state === "dodge" && f.st >= 3 && f.st <= (f.dodgeKind === "air" ? 20 : 16)) alpha = 0.45;
  const flash = f.flash > 0 && f.flash % 2 === 0;
  const pal = P.dim ? { body: X.dim, trim: pal0.trim, accent: pal0.accent } : flash ? { body: "#ffffff", trim: "#ffffff", accent: "#ffffff" } : pal0;
  const back = flash ? "#e8e8f0" : P.dim ? mix(X.dim, "#0b0c18", 0.35) : X.back;
  if (look.scarf && !at) { c.save(); c.globalAlpha = alpha; drawScarf(c, f, tk); c.restore(); }
  c.save();
  c.translate(ox, oy); c.globalAlpha = alpha;
  c.scale(f.facing, 1);
  if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(P.spin); c.translate(0, P.h * 0.5); }
  c.lineCap = "round"; c.lineJoin = "round";
  const lw = look.limbW, legLen = P.leg * 1.05, armLen = P.tor * 0.95;
  const shR = rot(P.sh, P.hip, P.lean);
  if (look.wings) drawWing(c, P, pal, f);
  if (look.tail) drawTail(c, P, pal, X, tk, f.slot);
  limbPath(c, P.hip, P.fB, legLen, "fwd", lw, back);
  limbPath(c, shR, P.hB, armLen, "down", lw - 1, back);
  if (look.fist) { c.beginPath(); c.arc(P.hB[0], P.hB[1], lw * 0.75, 0, Math.PI * 2); c.fillStyle = back; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke(); }
  limbPath(c, P.hip, P.fF, legLen, "fwd", lw, pal.body);
  c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
  drawTorso(c, look, P, pal, X);
  drawHead(c, look, P, pal);
  c.restore();
  limbPath(c, shR, P.hF, armLen, "down", lw, pal.body);
  if (look.fist) { c.beginPath(); c.arc(P.hF[0], P.hF[1], lw * 0.8, 0, Math.PI * 2); c.fillStyle = pal.trim; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke(); }
  if (f.armorFlash > 0 || (BL.armored(f) && tk % 6 < 3)) {
    c.strokeStyle = "rgba(255,240,200,0.8)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -P.h * 0.5, P.w * 0.9, P.h * 0.62, 0, 0, Math.PI * 2); c.stroke();
  }
  if (P.swoosh) {
    const S = P.swoosh;
    c.globalAlpha = alpha * (S.heavy ? 0.75 : 0.55);
    c.strokeStyle = pal0.accent; c.lineCap = "round";
    if (S.fire) {
      c.globalAlpha = alpha; drawFlame(c, P, S, tk);
    } else if (S.body) {
      c.lineWidth = 5; c.beginPath(); c.arc(0, -P.h * 0.5, S.r + 4, P.spin - 2.2, P.spin + 0.4); c.stroke();
    } else if (S.sweep) {
      c.lineWidth = S.r * 0.6; c.beginPath(); c.moveTo(S.sx, S.sy); c.quadraticCurveTo((S.sx + S.tx) / 2, Math.min(S.sy, S.ty) - S.r * 0.8, S.tx, S.ty); c.stroke();
    } else {
      c.lineWidth = S.r * (S.heavy ? 0.5 : 0.35); c.beginPath(); c.arc(S.tx - S.r * 0.45, S.ty, S.r * 0.95, -1.15, 1.15); c.stroke();
    }
  }
  c.restore();
}


/* ===================== heavy attacks =====================
   Every fighter's heavies share one language: a deeper wind-up with a white glint in the last two startup frames,
   a double-stroked swoosh in the fighter's element, a small camera shake and a low "whoomp" when the swing lands,
   and a bigger ring on the hit. Each heavy then gets its own look in HEAVY_LOOK[fighterId][moveKey]. UI only:
   nothing here touches the simulation (see pose(), drawHeavyFx(), heavySwing(), heavyHit() and Sfx.heavy()).
   An entry may define:
     pose(X)             bend the skeleton. X.hF / hB / fF / fB are hands and feet, X.P holds lean, crouch, mouth, wingUp, hop,
                         holdAng (weapon angle), sheath, tailSwing, cryK, ravenK, glintAt ... X.phase is 0 startup / 1 hit window /
                         2 endlag, X.wk the wind-up progress, X.u the hit-window progress, X.age frames since the window opened.
                         hpath(X, rest, wind, strike, strike2) walks one point (or number) through that timeline.
                         X.replace = true drops the classic swoosh; X.trail carries geometry to fx().
     fx(c, f, P, hv, tk) extra drawing in fighter space: swoosh styles, ground rings, glyphs (hv.sp = stroke progress, hv.post = frames since the window closed)
     keepSwoosh          keep drawing the classic swoosh during linger frames too
     linger              frames fx() keeps drawing after the hit window closes
     swing(f)            one-shot world effects when the hit window opens (dust, shards, rings)
     hit(att, e)         one-shot world effects when the move connects
   To add something per heavy, add a field here and read it in pose() / drawHeavyFx(). The charge-up glow (held heavies) lives in its own section at the end of this file. */
const HEAVY_KEYS = { hSide: 1, hUp: 1, hDown: 1, hAir: 1 };
const isHeavyKey = (k) => HEAVY_KEYS[k] === 1;
const mixv = (a, b, t) => (typeof a === "number" ? a + (b - a) * t : lerp2(a, b, t));
function hpath(X, rest, wind, strike, strike2) {
  if (X.phase === 0) {
    const p = mixv(rest, wind, X.wk);
    return X.mt >= X.startup ? mixv(p, strike, 0.5) : p;   // the last startup frame smears towards the strike
  }
  const s = strike2 ? mixv(strike, strike2, X.u) : strike;
  return X.phase === 1 ? s : mixv(s, rest, ease(X.k));
}

/* ---- small drawing helpers (fighter space) ---- */
let HV_K = 0;   // charge (0..1) of the heavy being drawn: brush() thickens every stroke, duoStroke() adds a second tone
function star4(c, x, y, s, colr) {
  c.fillStyle = colr || "#ffffff";
  c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.2, y - s * 0.2); c.lineTo(x + s, y); c.lineTo(x + s * 0.2, y + s * 0.2);
  c.lineTo(x, y + s); c.lineTo(x - s * 0.2, y + s * 0.2); c.lineTo(x - s, y); c.lineTo(x - s * 0.2, y - s * 0.2); c.closePath(); c.fill();
}
function qpts(a, b, d, n) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * a[0] + 2 * u * t * b[0] + t * t * d[0], u * u * a[1] + 2 * u * t * b[1] + t * t * d[1]]); } return o; }
function apts(cx, cy, rx, ry, a0, a1, n) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; }
function lpts(a, b, n) { const o = []; for (let i = 0; i <= n; i++) o.push(lerp2(a, b, i / n)); return o; }
// a tapered brush stroke through pts[0..n], sharp at both ends, filled with the current fillStyle
function brush(c, pts, wmax, n) {
  n = Math.min(n, pts.length - 1);
  if (n < 1) return;
  wmax *= 1 + 0.7 * HV_K;   // a charged heavy: every stroke is thicker
  const Lp = [], Rp = [];
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const wd = Math.max(0.4, wmax * 0.5 * Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * (i / n))), 0.55));
    Lp.push([pts[i][0] - dy * wd, pts[i][1] + dx * wd]); Rp.push([pts[i][0] + dy * wd, pts[i][1] - dx * wd]);
  }
  c.beginPath(); c.moveTo(Lp[0][0], Lp[0][1]);
  for (let i = 1; i <= n; i++) c.lineTo(Lp[i][0], Lp[i][1]);
  for (let i = n; i >= 0; i--) c.lineTo(Rp[i][0], Rp[i][1]);
  c.closePath(); c.fill();
}
// the double stroke every heavy swoosh shares: dark edge, element colour, bright core
function duoStroke(c, pts, n, wmax, colr, core, a) {
  if (HV_K > 0.04) { c.globalAlpha = a * 0.6; c.fillStyle = /^#/.test(colr) ? mix(colr, "#ffffff", 0.6) : "#fff6d8"; brush(c, pts, wmax * 1.3 + 7, n); }   // second tone, charged heavies only
  c.globalAlpha = a * 0.9; c.fillStyle = "rgba(20,15,30,0.85)"; brush(c, pts, wmax * 1.3 + 2, n);
  c.globalAlpha = a; c.fillStyle = colr; brush(c, pts, wmax, n);
  c.fillStyle = core; brush(c, pts, wmax * 0.4, n);
}
function gring(c, x, y, r, a, colr, edge) {
  if (a <= 0) return;
  c.save(); c.globalAlpha = Math.min(1, a);
  c.lineWidth = 6 * a + 1.5; c.strokeStyle = edge || "rgba(20,15,30,0.7)"; c.beginPath(); c.ellipse(x, y, r, r * 0.24, 0, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 3.4 * a + 0.8; c.strokeStyle = colr; c.stroke(); c.restore();
}
const RUNES = [
  [[0, -1, 0, 1], [0, -0.6, 0.7, -0.2, 0, 0.2]],                      // thurisaz
  [[0, -1, 0, 1], [0, -0.1, -0.7, -0.8], [0, -0.1, 0.7, -0.8]],       // algiz
  [[0, -1, 0, 1], [-0.7, -0.3, 0, -1, 0.7, -0.3]],                    // tiwaz
  [[0, -1, 0, 1], [0, -0.4, 0.7, -0.9], [0, 0.2, 0.7, -0.3]],         // fehu
  [[-0.6, 1, 0, -1, 0.6, 1], [-0.45, 0.2, 0.45, 0.2]],                // othala-ish
];
function rune(c, x, y, s, which, colr, wd) {
  c.save(); c.translate(x, y); c.scale(s, s); c.lineCap = "round"; c.lineJoin = "round";
  for (const [pass, lw] of [[0, wd + 3.2], [1, wd]]) {
    c.strokeStyle = pass ? colr : "rgba(20,15,30,0.8)"; c.lineWidth = lw / s;
    c.beginPath();
    for (const line of RUNES[which % RUNES.length]) { c.moveTo(line[0], line[1]); for (let i = 2; i < line.length; i += 2) c.lineTo(line[i], line[i + 1]); }
    c.stroke();
  }
  c.restore();
}
function flaskShape(c, x, y, s, rot0, liquid) {
  c.save(); c.translate(x, y); c.rotate(rot0); c.scale(s, s);
  c.beginPath(); c.arc(0, 4, 8, 0, Math.PI * 2); c.fillStyle = "rgba(230,255,245,0.85)"; c.fill();
  c.beginPath(); c.arc(0, 4, 6.2, 0.1, Math.PI - 0.1); c.lineTo(-6, 2.2); c.lineTo(6, 2.2); c.closePath(); c.fillStyle = liquid || "#7dff62"; c.fill();
  c.beginPath(); c.arc(0, 4, 8, 0, Math.PI * 2); c.lineWidth = 1.8 / s * s; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = "rgba(230,255,245,0.9)"; c.fillRect(-2.6, -9, 5.2, 8); c.lineWidth = 1.4; c.strokeRect(-2.6, -9, 5.2, 8);
  c.fillStyle = "#b8863b"; c.fillRect(-3.4, -12, 6.8, 3.6); c.strokeRect(-3.4, -12, 6.8, 3.6);
  c.fillStyle = "rgba(255,255,255,0.8)"; c.beginPath(); c.ellipse(-3, 2, 1.8, 3, 0.4, 0, Math.PI * 2); c.fill();
  c.restore();
}

/* ---- the glint in the last two startup frames, then the look's own fx ---- */
function drawGlint(c, f, P, tk) {
  const a = P.pre;
  if (!a) return;
  const L = P.hv && P.hv.look, gc = (L && L.glintCol) || "#ffffff";
  c.save();
  if (P.rx) {
    // rim light round the potato
    c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
    c.globalAlpha = 0.3 * a; c.strokeStyle = gc; c.lineWidth = 7; c.beginPath(); c.ellipse(0, P.cy, P.rx + 2, P.ry + 2, 0, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 0.95 * a; c.strokeStyle = "#ffffff"; c.lineWidth = 2.6; c.stroke();
  }
  c.restore();
  // a sparkle where the swing will come from
  let g = P.hF;
  if (P.glintAt === "tip") g = P.staffTip || P.hF;
  else if (P.glintAt === "katana") { const sh = rot(P.sh, P.hip, P.lean), ang = heldDir(f, P, sh, -0.8); g = [P.hF[0] + Math.cos(ang) * 8, P.hF[1] + Math.sin(ang) * 8]; }
  else if (P.glintAt === "horns") g = rot([-P.w * 0.05 - 9, P.top - 14], P.hip, P.lean);
  else if (P.glintAt === "foot") g = P.fF;
  else if (P.glintAt) g = P.glintAt;
  c.save(); c.globalAlpha = a;
  const gl = c.createRadialGradient(g[0], g[1], 1, g[0], g[1], 20);
  gl.addColorStop(0, "rgba(255,255,255,0.8)"); gl.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gl; c.beginPath(); c.arc(g[0], g[1], 20, 0, Math.PI * 2); c.fill();
  star4(c, g[0], g[1], 15 * (0.6 + 0.4 * a), "#ffffff");
  star4(c, g[0], g[1], 7, gc);
  c.restore();
}
function drawHeavyFx(c, f, P, tk) {
  const hv = P.hv;
  if (!hv) return;
  hv.post = hv.phase === 2 ? hv.age - (hv.active - 1) : 0;
  hv.sp = hv.phase === 0 ? 0 : hv.phase === 1 ? clamp((hv.age + 1.6) / (hv.active - 0.2), 0.45, 1) : 1;
  const L = hv.look;
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  if (P.flask) flaskShape(c, P.hF[0] + 3, P.hF[1] - 10, 1.15, hv.phase === 0 ? Math.sin(tk * 0.5) * 0.12 : 0.2, "#7dff62");
  HV_K = hv.ck || 0;
  try { if (L && L.fx && (hv.phase === 1 || (hv.phase === 2 && hv.post <= (L.linger || 0)) || L.fxStartup)) L.fx(c, f, P, hv, tk); } finally { HV_K = 0; }
  c.restore();
  drawCharge(c, f, P, tk);
  drawGlint(c, f, P, tk);
}
// world-space marks that outlive the swing (claw slashes, rune glyphs); they ride in the shared fx list and are drawn by their owner
function drawHx(c, slot) {
  for (const e of fx) {
    if (e.k !== "hx" || e.owner !== slot) continue;
    const q = e.t / e.life, a = Math.min(1, (1 - q) * 2.2);
    c.save(); c.translate(e.x, e.y); c.scale(e.dir || 1, 1); c.lineCap = "round"; c.lineJoin = "round"; c.globalAlpha = a;
    if (e.sub === "slash") {
      const grow = Math.min(1, (e.t + 1) / 3), ang = 0.95, ca = Math.cos(ang), sa = Math.sin(ang);
      for (let i = -1; i <= 1; i++) {
        const ox = -sa * i * 12 + i * 2, oy = ca * i * 12, len = 27 * grow * (i === 0 ? 1.1 : 0.9);
        const pts = lpts([ox - ca * len, oy - sa * len], [ox + ca * len, oy + sa * len], 8);
        c.fillStyle = "rgba(17,16,28,0.85)"; brush(c, pts, 8.5, 8);
        c.fillStyle = "#f3ede2"; brush(c, pts, 5, 8);
        c.fillStyle = e.col; brush(c, pts, 1.8, 8);
      }
    } else if (e.sub === "rune") {
      const r = 8 + 14 * ease(Math.min(1, e.t / 6));
      c.strokeStyle = e.col; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r + 6, 0, Math.PI * 2); c.stroke();
      rune(c, 0, 0, r * 0.7, e.which || 0, "#ffffff", 2.4);
    }
    c.restore();
  }
}

/* ---- one-shot world effects, called from handleEvent (effects.js) ---- */
// Runs when a heavy starts: waits for the hit window (a charging heavy holds at its hold point first), then shakes the camera and plays the heavy sound.
function heavySwing(g, f, live) {
  const key = f.mid, mv = f.move, moveT = f.moveT, slot = f.slot;
  let tries = 0;
  const poll = () => {
    const q = g.fighters[slot];
    if (!q || q.state !== "attack" || q.mid !== key || q.moveT !== moveT || ++tries > 400) return;   // hit out of it, or done
    if (paused || q.mt < mv.startup) { setTimeout(poll, 16); return; }
    cam.shake = Math.max(cam.shake, 3 + 3 * (q.chg / BL.TUNE.chgMax));
    const L = HEAVY_LOOK[q.spec.id] && HEAVY_LOOK[q.spec.id][key];
    if (L && L.swing) L.swing(q);
    if (live) Sfx.heavy(q.spec.id, key);
  };
  setTimeout(poll, Math.max(0, (mv.startup - 4) * STEP));
}
// Runs when a heavy connects: the ring is half as big again, plus the fighter's own sparks.
function heavyHit(att, e) {
  const kb = e.kb || 10, c0 = e.fire ? "#ff8a3d" : col(e.pal), ck = (e.chg || 0) / BL.TUNE.chgMax, big = 1 + 0.5 * ck;
  addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 18, r0: 12, r1: (26 + kb * 2.4) * 1.5 * big, col: c0 });
  addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 12, r0: 4, r1: (26 + kb * 2.4) * 0.8 * big, col: "#ffffff" });
  if (kb <= 14 || ck > 0.3) addFx({ k: "star", x: e.x, y: e.y, t: 0, life: 8, s: (36 + kb * 1.6) * (1 + 0.25 * ck) });
  if (ck > 0.1) burstLines(e.x, e.y, 4 + Math.round(8 * ck), [c0, "#ffffff"], 6 + 4 * ck);
  const L = HEAVY_LOOK[att.spec.id] && HEAVY_LOOK[att.spec.id][att.mid];
  if (L && L.hit) L.hit(att, e);
}
const hxAdd = (att, e, o) => addFx(Object.assign({ k: "hx", owner: att.slot, x: e.x, y: e.y, dir: att.facing, t: 0, life: 10, col: att.pal.accent }, o));
const frand = (a, b) => a + Math.random() * (b - a);
function burstLines(x, y, n, cols, sp) {
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.random() * 0.4; addFx({ k: "line", x, y, vx: Math.cos(a) * (sp || 6), vy: Math.sin(a) * (sp || 6), t: 0, life: 12 + Math.random() * 6, col: cols[i % cols.length], w: 2.6 }); }
}
function groundDust(f, offs, n) { for (const o of offs) dust(f.x + o * f.facing, f.y, n || 4, 26); }

/* ---- the looks ---- */
const HEAVY_LOOK = {
  dragon: {
    // three bone-white claws raked down from above the head
    hSide: {
      name: "Claw rake", linger: 12,
      pose(X) {
        const { P, w, h, leg, tor } = X;
        X.replace = true;
        X.hF = hpath(X, X.hF, [w * 0.04, -h - 7], [30, -62], [64, -20]);
        X.hB = hpath(X, X.hB, [-w * 0.55, -leg - tor * 0.45], [-w * 0.35, -leg - tor * 0.4]);
        P.lean = hpath(X, 0, -0.3, 0.36);
        P.mouth = hpath(X, 0, 0.5, 1);
        P.wingUp = hpath(X, 0, 0.45, 0.7);
        P.glintAt = [w * 0.04 + 2, -h - 7];
      },
      fx(c, f, P, hv, tk) { clawRake(c, f, hv, [8, -78], [72, -72], [92, 12]); },
      hit(att, e) { hxAdd(att, e, { sub: "slash" }); },
    },
    // head and shoulders toss upward, both wings snapping up, horn tips flashing
    hUp: {
      name: "Horn toss", linger: 10, glintCol: "#ffd27a",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        X.replace = true;
        P.lean = hpath(X, 0, -0.34, 0.3);
        P.mouth = hpath(X, 0, 0.8, 1);
        P.wingUp = hpath(X, 0, 0.25, 1);
        P.hop = hpath(X, 0, 0, 6);
        X.hF = hpath(X, X.hF, [w * 0.45, -leg - tor * 0.3], [w * 0.8, -h * 0.72]);
        X.hB = hpath(X, X.hB, [-w * 0.2, -leg - tor * 0.3], [-w * 0.7, -h * 0.68]);
        P.hornFlash = X.phase === 1 ? 1 : X.phase === 0 ? P.pre : 0;
        P.glintAt = "horns";
      },
      fx(c, f, P, hv, tk) {
        wingArc(c, f, P, hv);
        const a = hv.phase === 1 ? 1 : Math.max(0, 1 - hv.post / 8);
        for (const x0 of [-P.w * 0.2, P.w * 0.12]) { const t = rot([x0 - 8, P.top - 13], P.hip, P.lean); c.globalAlpha = a; star4(c, t[0], t[1], 11, "#ffffff"); }
      },
      hit(att, e) { burstLines(e.x, e.y, 8, ["#ffd27a", "#ff9a3d"], 6); for (let i = 0; i < 8; i++) ember(e.x, e.y, frand(-4, 4), frand(-5, 0)); },
    },
    // the tail whips round to both sides
    hDown: {
      name: "Tail sweep", linger: 12,
      pose(X) {
        const { P, w, h, leg, tor } = X;
        P.spin = 0; X.replace = true;
        P.crouch = Math.max(P.crouch, 0.3 * (X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(X.k)));
        X.fF = [w * 0.3, 0]; X.fB = [-w * 0.2, 0];
        P.lean = hpath(X, 0, 0.14, 0.1);
        X.hF = hpath(X, X.hF, [w * 0.6, -leg - tor * 0.25], [w * 0.75, -leg - tor * 0.2]);
        X.hB = hpath(X, X.hB, [w * 0.35, -leg - tor * 0.2], [w * 0.5, -leg - tor * 0.2]);
        // the tail coils up and back, then whirls once round the body (it keeps going a little after the hit window)
        const turns = X.phase === 0 ? 0 : X.phase === 1 ? X.u : 1 + ease(Math.min(1, X.k * 1.8));
        const wind = X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(Math.min(1, X.k * 1.2));
        const R = w * 1.35, ph = turns * Math.PI * 2;
        P.tailTo = X.phase === 0 || (X.phase === 2 && X.k > 0.55) ? mixv([-w * 1.3, -leg * 0.4], [-w * 0.95, -h * 0.62], wind) : [-Math.cos(ph) * R, -leg * 0.45 + Math.sin(ph) * 10];
        P.tailSwing = wind * -0.7 + turns * Math.PI * 2; P.tailLift = -0.45 * wind;
        P.glintAt = [-w * 0.9, -h * 0.62];
      },
      fx(c, f, P, hv, tk) { dustArcs(c, f, P, hv, 56, "#d9d4ea", f.pal.accent); },
      swing(f) { groundDust(f, [46, -46], 5); },
      hit(att, e) { groundDust(att, [40, -40], 3); },
    },
    // both claws forward in a dive, wings tucked
    hAir: {
      name: "Claw dive", linger: 10,
      pose(X) {
        const { P, w, h, leg, tor } = X;
        X.replace = true;
        P.lean = hpath(X, 0, -0.15, 0.5);
        P.mouth = hpath(X, 0, 0.5, 1);
        P.wingUp = hpath(X, 0, 0.3, -0.6);
        X.hF = hpath(X, X.hF, [w * 0.1, -h * 0.74], [36, -40], [60, -34]);
        X.hB = hpath(X, X.hB, [-w * 0.05, -h * 0.66], [30, -28], [50, -24]);
        X.fF = hpath(X, X.fF, [-w * 0.1, -leg * 0.3], [-w * 0.25, -leg * 0.3]); X.fB = hpath(X, X.fB, [-w * 0.3, -leg * 0.2], [-w * 0.55, -leg * 0.2]);
        P.glintAt = [w * 0.1, -h * 0.74];
      },
      fx(c, f, P, hv, tk) { clawRake(c, f, hv, [6, -66], [68, -68], [92, 4]); },
      hit(att, e) { hxAdd(att, e, { sub: "slash" }); },
    },
  },

  samurai: {
    // the blade stays sheathed, one very wide horizontal cut, then it clicks home
    hSide: {
      name: "Iaido", linger: 8, glintAt: "katana",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        X.replace = true;
        const sAng = Math.PI - 0.5;
        P.crouch = Math.max(P.crouch, 0.3 * (X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(X.k)));
        P.lean = hpath(X, 0, 0.14, 0.18);
        X.hF = hpath(X, X.hF, [w * 0.1, -leg - tor * 0.3], [w * 0.5, X.ty + 2]);
        X.hB = hpath(X, X.hB, [-w * 0.45, -leg - tor * 0.3], [-w * 0.3, -leg - tor * 0.5]);
        P.holdAng = hpath(X, -0.8, sAng, 0.02);
        if (X.phase === 2) P.holdAng = mixv(0.02, sAng, ease(clamp((X.k - 0.25) / 0.45, 0, 1)));
        P.sheath = X.phase === 0 ? (X.mt >= X.startup ? 0.5 : 1) : X.phase === 1 ? 0 : clamp((X.k - 0.3) / 0.4, 0, 1);
        P.glintAt = "katana";
        X.trail = { line: [[10, X.ty + 2], [94, X.ty + 2]] };
      },
      fx(c, f, P, hv, tk) { inkStroke(c, f, lpts(hv.trail.line[0], hv.trail.line[1], 18), hv, 13, 8); if (hv.phase === 1 && hv.age <= 1) { c.globalAlpha = 0.7; c.strokeStyle = "#ffffff"; c.lineWidth = 3; c.beginPath(); c.moveTo(hv.trail.line[0][0], hv.trail.line[0][1] - 1); c.lineTo(hv.trail.line[1][0], hv.trail.line[1][1] - 1); c.stroke(); } },
      swing(f) { for (let i = 0; i < 3; i++) addFx({ k: "petal", x: f.x + f.facing * frand(20, 60), y: f.y - frand(25, 45), vx: f.facing * frand(1, 3), vy: frand(-1, 0.2), rot: frand(0, 6), vr: frand(-0.2, 0.2), col: mix(f.pal.accent, "#ffb7c9", 0.6), r: frand(2.2, 3), t: 0, life: 30, g: 0.03, damp: 0.96 }); },
      hit(att, e) { addFx({ k: "flashline", x1: att.x, x2: e.x + att.facing * 40, y: e.y, col: att.pal.accent, t: 0, life: 14 }); },
    },
    // crouch, then the blade sweeps from hip to overhead in a tall ink arc with a petal burst
    hUp: {
      name: "Rising cut", linger: 9, glintAt: "katana",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        X.replace = true;
        P.crouch = Math.max(P.crouch, 0.3 * (X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(X.k)));
        const h1 = [w * 0.45, -leg - tor * 0.32], h2 = [w * 0.2, -leg - tor * 0.78];
        X.hF = hpath(X, X.hF, [-w * 0.12, -leg - tor * 0.1], h1, h2);
        X.hB = hpath(X, X.hB, [-w * 0.45, -leg - tor * 0.3], [-w * 0.3, -leg - tor * 0.55]);
        P.holdAng = hpath(X, -0.8, 2.3, 0.5, -2.75);
        P.lean = hpath(X, 0, -0.12, 0.1);
        X.trail = { h1, h2, a1: 0.5, a2: -2.75 };
        P.glintAt = "katana";
      },
      fx(c, f, P, hv, tk) { inkArc(c, f, P, hv, 11); petals(c, f, hv, tk, 9); },
      swing(f) { for (let i = 0; i < 5; i++) addFx({ k: "petal", x: f.x + f.facing * frand(0, 30), y: f.y - frand(60, 85), vx: f.facing * frand(-1, 2), vy: frand(-2, -0.4), rot: frand(0, 6), vr: frand(-0.2, 0.2), col: mix(f.pal.accent, "#ffb7c9", 0.6), r: frand(2.2, 3.2), t: 0, life: 34, g: 0.04, damp: 0.96 }); },
      hit(att, e) { for (let i = 0; i < 6; i++) addFx({ k: "petal", x: e.x, y: e.y, vx: frand(-3, 3), vy: frand(-3, 0), rot: frand(0, 6), vr: frand(-0.2, 0.2), col: mix(att.pal.accent, "#ffb7c9", 0.6), r: frand(2.4, 3.4), t: 0, life: 30, g: 0.05, damp: 0.95 }); },
    },
    // the spin stays; the blade is held straight out and an ink ring sweeps the floor
    hDown: {
      name: "Low sweep", linger: 12, glintAt: "katana",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        X.replace = true;
        P.crouch = Math.max(P.crouch, 0.4 * (X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(X.k)));
        P.lean = hpath(X, 0, 0.12, 0.05);
        X.hF = hpath(X, X.hF, [w * 0.5, -leg - tor * 0.3], [w * 0.8, -leg - tor * 0.3]);
        X.hB = hpath(X, X.hB, [-w * 0.2, -leg - tor * 0.3], [-w * 0.3, -leg - tor * 0.3]);
        P.holdAng = X.phase === 2 ? mixv(0, -0.8, ease(X.k)) : 0;
        if (X.phase === 0) { P.holdAng = mixv(-0.8, 0, X.wk); X.hF = hpath(X, X.hF, X.hF, X.hF); }
        P.glintAt = "katana";
      },
      fx(c, f, P, hv, tk) {
        // the ink ring lies flat on the floor, so undo the body spin
        if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(-P.spin); c.translate(0, P.h * 0.5); }
        dustArcs(c, f, P, hv, 60, "rgba(20,15,30,0.92)", f.pal.accent, true);
      },
      swing(f) { groundDust(f, [44, -44], 3); },
    },
    // the arm swing with an ink stroke
    hAir: {
      name: "Ink swing", linger: 9, glintAt: "katana",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        X.replace = true;
        const h1 = [w * 0.35, -leg - tor * 0.78], h2 = [w * 0.45, -leg - tor * 0.5];
        X.hF = hpath(X, X.hF, [w * 0.05, -leg - tor * 0.85], h1, h2);
        P.holdAng = hpath(X, -0.8, -2.0, -1.55, 0.35);
        P.lean = hpath(X, 0, -0.18, 0.2);
        X.trail = { h1, h2, a1: -1.55, a2: 0.35 };
        P.glintAt = "katana";
      },
      fx(c, f, P, hv, tk) { inkArc(c, f, P, hv, 10); },
    },
  },

  odin: {
    // both fists back with the armour ring showing, then forward together; a rune flashes at the impact
    hSide: {
      name: "Hammer fists", linger: 14, glintCol: "#bfe3ff",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        P.crouch = Math.max(P.crouch, 0.32 * (X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(X.k)));
        X.hF = hpath(X, X.hF, [-w * 0.5, -leg - tor * 0.62], [X.tx, X.ty]);
        X.hB = hpath(X, X.hB, [-w * 0.62, -leg - tor * 0.5], [X.tx - 14, X.ty + 8]);
        if (X.phase === 0) { X.fF = [w * 0.3, 0]; X.fB = [-w * 0.3, 0]; }
        P.lean = hpath(X, 0, -0.25, 0.3);
        P.glintAt = [-w * 0.5, -leg - tor * 0.62];
      },
      fx(c, f, P, hv, tk) { shockArcs(c, f, hv, "#bfe3ff"); runeHit(c, f, hv, hv.tx + hv.b.r * 0.55, hv.ty, 0); },
      hit(att, e) { for (let i = 0; i < 6; i++) addFx({ k: "puff", x: e.x, y: e.y, vx: frand(-2.5, 2.5), vy: frand(-2, 0), r: frand(3, 5), t: 0, life: 24, col: "#dfeeff" }); hxAdd(att, e, { sub: "rune", which: 0, col: "#8fc8ff", life: 14 }); },
    },
    // an uppercut with the raven lifting off his shoulder
    hUp: {
      name: "Raven rise", linger: 14, glintCol: "#bfe3ff",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        X.hF = hpath(X, X.hF, [-w * 0.15, -leg - tor * 0.12], [X.b.x, X.b.y], [X.b.x2, X.b.y2]);
        X.hB = hpath(X, X.hB, [-w * 0.55, -leg - tor * 0.4], [-w * 0.4, -leg - tor * 0.5]);
        P.lean = hpath(X, 0, -0.18, 0.12);
        P.ravenTo = [X.hF[0] - 6, X.hF[1] - 20];
        P.ravenK = X.phase === 0 ? (X.mt >= X.startup ? 0.3 : 0.05 * X.wk) : X.phase === 1 ? 1 : 1 - ease(clamp(X.k * 1.5, 0, 1));
        P.glintAt = [-w * 0.15, -leg - tor * 0.12];
      },
      fx(c, f, P, hv, tk) { runeHit(c, f, hv, 4, hv.b ? hv.b.y - 14 : -98, 2); },
      swing(f) { for (let i = 0; i < 4; i++) addFx({ k: "feather", x: f.x - f.facing * 12 + frand(-6, 6), y: f.y - f.s.h * 0.85, vx: frand(-1, 1.5) * f.facing, vy: frand(-2.4, -0.8), rot: frand(0, 6), vr: frand(-0.15, 0.15), t: 0, life: 50, g: 0.05, damp: 0.95 }); },
      hit(att, e) { for (let i = 0; i < 4; i++) addFx({ k: "feather", x: e.x, y: e.y, vx: frand(-3, 3), vy: frand(-3, 0), rot: frand(0, 6), vr: frand(-0.15, 0.15), t: 0, life: 42, g: 0.06, damp: 0.95 }); hxAdd(att, e, { sub: "rune", which: 2, col: "#8fc8ff", life: 14 }); },
    },
    // both fists driven into the floor; shock ring plus a rune ring
    hDown: {
      name: "Stomp", linger: 16, glintCol: "#bfe3ff",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        P.crouch = Math.max(P.crouch, 0.5 * (X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(X.k)));
        X.hF = hpath(X, X.hF, [w * 0.3, -h * 0.98], [X.b.x, -7]);
        X.hB = hpath(X, X.hB, [-w * 0.05, -h * 0.92], [-X.b.x * 0.9, -7]);
        X.fF = [w * 0.38, 0]; X.fB = [-w * 0.36, 0];
        P.lean = hpath(X, 0, -0.12, 0.34);
        P.glintAt = [w * 0.3, -h * 0.98];
      },
      fx(c, f, P, hv, tk) {
        const age = Math.max(0, hv.age + (hv.phase === 0 ? 0 : 1)), a = 1 - age / 16;
        for (const sx of [1, -1]) gring(c, sx * 40, -4, 12 + age * 4.2, a, "#e8f2ff");
        if (hv.phase > 0) { c.globalAlpha = a; for (const sx of [1, -1]) rune(c, sx * 40, -22 - age * 0.4, 9, sx > 0 ? 3 : 1, "#bfe3ff", 2.2); }
      },
      swing(f) {
        addFx({ k: "shock", x: f.x, y: f.y, t: 0, life: 18 }); dust(f.x, f.y, 8, 60);
        addFx({ k: "runering", x: f.x, y: f.y, col: "#bfe3ff", t: 0, life: 36, r: f.s.w * 1.2 });
      },
    },
    // both fists overhead, then hammered down in front
    hAir: {
      name: "Hammer drop", linger: 10, glintCol: "#bfe3ff",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        X.hF = hpath(X, X.hF, [w * 0.12, -h - 16], [X.tx, X.ty]);
        X.hB = hpath(X, X.hB, [-w * 0.1, -h - 10], [X.tx - 12, X.ty + 6]);
        P.lean = hpath(X, 0, -0.2, 0.4);
        P.glintAt = [w * 0.12, -h - 16];
        const sh = [w * 0.38, -leg - tor * 0.7];
        X.trail = { h1: sh, h2: sh, a1: -1.75, a2: 0.15, L: 56 };
      },
      fx(c, f, P, hv, tk) { inkArc(c, f, P, hv, 13, f.pal.accent, "#e8f2ff"); runeHit(c, f, hv, hv.tx + hv.b.r * 0.4, hv.ty, 1); },
      hit(att, e) { hxAdd(att, e, { sub: "rune", which: 1, col: "#8fc8ff", life: 14 }); },
    },
  },

  wizard: {
    // the crystal flares while he winds up; the sweep leaves three star motes (see drawMagic)
    hSide: {
      name: "Magic sweep", glintAt: "tip",
      pose(X) { X.P.cryK = hpath(X, 1, 2, 2); X.P.glintAt = "tip"; },
    },
    hUp: {
      name: "Magic rise", glintAt: "tip",
      pose(X) { X.P.cryK = hpath(X, 1, 2, 2); X.P.glintAt = "tip"; },
    },
    // staff overhead while he winds up, then slammed into the floor
    hDown: {
      name: "Staff slam", linger: 16, glintAt: "tip",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        P.spin = 0; X.replace = true;
        P.crouch = Math.max(P.crouch, 0.2 * (X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(X.k)));
        X.fF = [w * 0.32, 0]; X.fB = [-w * 0.2, 0];
        P.lean = hpath(X, 0, -0.12, 0.3);
        X.hF = hpath(X, X.hF, [w * 0.28, -h * 0.82], [w * 0.62, -tor * 0.8 - leg * 0.3]);
        X.hB = hpath(X, X.hB, [w * 0.05, -h * 0.76], [w * 0.42, -tor * 0.7]);
        P.holdAng = hpath(X, -1.45, -1.62, 1.15);
        P.cryK = hpath(X, 1, 2, 2.4);
        P.glintAt = "tip";
      },
      fx(c, f, P, hv, tk) {
        const tip = P.staffTip || [P.w * 0.95, -4], age = Math.max(0, hv.age + 1), a = 1 - age / 16;
        const x = tip[0], y = Math.min(-2, tip[1]);
        gring(c, x, y + 2, 14 + age * 5.4, a, "#ffd98a", "rgba(60,200,230,0.8)");
        gring(c, x, y + 2, 7 + age * 3.6, a * 0.8, "#bff3ff", "rgba(255,217,138,0.7)");
        c.globalAlpha = a;
        for (let i = 0; i < 6; i++) { const s = (i % 2 ? 1 : -1), d = 8 + age * (3 + i * 0.9); star4(c, x + s * d, y - 6 - Math.sin(age * 0.5 + i) * 7 - i * 1.5, 5.5 - i * 0.4, i % 2 ? "#fff6d8" : "#bff3ff"); }
      },
      swing(f) { addFx({ k: "shock", x: f.x + f.facing * 46, y: f.y, t: 0, life: 18 }); dust(f.x + f.facing * 46, f.y, 6, 50); for (let i = 0; i < 6; i++) mote(f.x + f.facing * 46 + frand(-30, 30), f.y - frand(4, 20), frand(-2, 2), frand(-2.4, -0.6), i % 2 ? "#ffd98a" : "#7fe3ff", frand(1.5, 2.4), 24); },
      hit(att, e) { for (let i = 0; i < 6; i++) mote(e.x, e.y, frand(-3.5, 3.5), frand(-3.5, 0.5), i % 2 ? "#ffd98a" : "#7fe3ff", frand(1.6, 2.6), 22); },
    },
    hAir: { name: "Magic sweep", pose(X) { X.P.cryK = hpath(X, 1, 2, 2); X.P.glintAt = "tip"; } },
  },

  phoenix: {
    // the fire headbutt: wings fold in the wind-up, the flame is half as big again with an ember comet
    hSide: {
      name: "Fire headbutt", glintAt: "foot",
      pose(X) { const { P, w, h } = X; P.wingUp = hpath(X, 0, -0.8, 0.4); P.glintAt = [w * 0.3, -h * 0.82]; },
      hit(att, e) { addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 20, r0: 10, r1: 70, col: "#ffc04d" }); for (let i = 0; i < 8; i++) ember(e.x, e.y, frand(-4, 4), frand(-4, 0)); },
    },
    // both arms up, wings snap open, a fire arc over the head, embers rain down
    hUp: {
      name: "Wing flare", linger: 14, glintCol: "#ffd27a",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        X.replace = true;
        P.wingUp = hpath(X, 0, -0.35, 1);
        P.hop = hpath(X, 0, 0, 6);
        X.hF = hpath(X, X.hF, [w * 0.3, -leg - tor * 0.5], [w * 0.2, -h - 8]);
        X.hB = hpath(X, X.hB, [-w * 0.1, -leg - tor * 0.5], [-w * 0.25, -h - 4]);
        P.lean = hpath(X, 0, -0.14, 0.08);
        P.glintAt = [w * 0.2, -h - 8];
      },
      fx(c, f, P, hv, tk) { fireArc(c, f, P, hv); },
      swing(f) { for (let i = 0; i < 6; i++) ember(f.x + frand(-26, 26), f.y - f.s.h - frand(6, 26), frand(-0.6, 0.6), frand(0.4, 1.6)); },
      hit(att, e) { addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 20, r0: 10, r1: 66, col: "#ffc04d" }); for (let i = 0; i < 8; i++) ember(e.x, e.y, frand(-4, 4), frand(-4, 0)); },
    },
    // crouch, both feet slammed out, orange shock rings along the ground
    hDown: {
      name: "Ember stomp", linger: 14, glintAt: "foot", glintCol: "#ffd27a",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        P.crouch = Math.max(P.crouch, 0.34 * (X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(X.k)));
        X.hF = hpath(X, X.hF, [w * 0.4, -leg - tor * 0.7], [w * 0.75, -leg - tor * 0.45]);
        X.hB = hpath(X, X.hB, [-w * 0.3, -leg - tor * 0.7], [-w * 0.65, -leg - tor * 0.4]);
        P.wingUp = hpath(X, 0, 0.2, 0.7);
        P.glintAt = [w * 0.2, -leg * 0.5];
      },
      fx(c, f, P, hv, tk) {
        const age = Math.max(0, hv.age + 1), a = 1 - age / 14;
        for (const sx of [1, -1]) { gring(c, sx * 34, -3, 10 + age * 4.4, a, "#ff9a3d", "rgba(120,30,10,0.7)"); gring(c, sx * 34, -3, 5 + age * 2.8, a * 0.8, "#ffe08a", "rgba(255,120,40,0.6)"); }
      },
      swing(f) { for (const s of [1, -1]) for (let i = 0; i < 5; i++) ember(f.x + s * f.facing * 34 + frand(-8, 8), f.y - 4, s * f.facing * frand(0.5, 3), frand(-3, -0.5)); dust(f.x, f.y, 6, 70); },
      hit(att, e) { for (let i = 0; i < 8; i++) ember(e.x, e.y, frand(-4, 4), frand(-4, 0)); },
    },
    // the headbutt with a roll and a longer flame tail
    hAir: {
      name: "Fire dive",
      pose(X) { const { P, w, h } = X; P.lean += hpath(X, 0, -0.1, 0.3); P.wingUp = hpath(X, 0, -0.5, 0.3); P.glintAt = [w * 0.3, -h * 0.82]; },
      hit(att, e) { addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 20, r0: 10, r1: 70, col: "#ffc04d" }); for (let i = 0; i < 8; i++) ember(e.x, e.y, frand(-4, 4), frand(-4, 0)); },
    },
  },

  alchemist: {
    // zaps: a green sparkle gathers at the hand, a green burst star on the hit
    hSide: { name: "Zap", glintCol: "#9dff7a", pose(X) { X.P.glintAt = null; }, hit(att, e) { greenBurst(e); } },
    hUp: { name: "Zap rise", glintCol: "#9dff7a", pose(X) { X.P.glintAt = null; }, hit(att, e) { greenBurst(e); } },
    // the hand slams a flask into the floor; green bursts both sides
    hDown: {
      name: "Flask smash", linger: 14, glintCol: "#9dff7a",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        P.spin = 0; X.replace = true;
        P.crouch = Math.max(P.crouch, 0.3 * (X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(X.k)));
        X.fF = [w * 0.3, 0]; X.fB = [-w * 0.2, 0];
        P.lean = hpath(X, 0, -0.1, 0.4);
        X.hF = hpath(X, X.hF, [w * 0.3, -h - 8], [w * 0.8, -8]);
        X.hB = hpath(X, X.hB, [-w * 0.3, -leg - tor * 0.5], [w * 0.1, -leg - tor * 0.4]);
        P.flask = X.phase < 2 && !(X.phase === 1 && X.age >= 0) ? 1 : 0;
        P.glintAt = [w * 0.3, -h - 8];
      },
      fx(c, f, P, hv, tk) {
        const age = Math.max(0, hv.age + 1), a = 1 - age / 14, x0 = P.hF[0];
        for (const sx of [1, -1]) {
          const cx = sx * 33;
          gring(c, cx, -5, 8 + age * 3.6, a, "#7dff62", "rgba(20,90,30,0.7)");
          c.globalAlpha = a; c.lineWidth = 2.4; c.strokeStyle = "#d9ffcf";
          for (let i = 0; i < 7; i++) { const an = -Math.PI * (i + 0.5) / 7, r0 = 6 + age * 2.6, r1 = r0 + 7 + age; c.beginPath(); c.moveTo(cx + Math.cos(an) * r0, -5 + Math.sin(an) * r0 * 1.1); c.lineTo(cx + Math.cos(an) * r1, -5 + Math.sin(an) * r1 * 1.1); c.stroke(); }
        }
        // glass shards fly from the hand
        c.globalAlpha = a;
        for (let i = 0; i < 7; i++) { const an = -0.2 - i * 0.42 + (i % 2) * 0.2, d = 6 + age * (3 + (i % 3)), s = 3 - (i % 3) * 0.6; c.save(); c.translate(x0 + Math.cos(an) * d * 1.3, -8 + Math.sin(an) * d - age * 0.3); c.rotate(age * 0.5 + i); c.fillStyle = i % 2 ? "rgba(230,255,245,0.95)" : "#7dff62"; c.beginPath(); c.moveTo(0, -s * 1.5); c.lineTo(s, s); c.lineTo(-s, s * 0.6); c.closePath(); c.fill(); c.restore(); }
      },
      swing(f) { addFx({ k: "ring", x: f.x + f.facing * 33, y: f.y - 6, t: 0, life: 16, r0: 8, r1: 44, col: "#7dff62" }); addFx({ k: "ring", x: f.x - f.facing * 33, y: f.y - 6, t: 0, life: 16, r0: 8, r1: 44, col: "#7dff62" }); },
      hit(att, e) { greenBurst(e); },
    },
    hAir: { name: "Zap", glintCol: "#9dff7a", pose(X) { X.P.glintAt = null; }, hit(att, e) { greenBurst(e); } },
  },

  gunslinger: {
    // Fan the hammer: both pistols out at chest height, the free hand fans the hammer (the flashes alternate), the recoil throws him back
    hSide: {
      name: "Fan the hammer", linger: 16, glintCol: "#ffd27a",
      pose(X) {
        const { P, w, leg, tor } = X;
        X.replace = true;
        X.hF = hpath(X, X.hF, [w * 0.42, -leg - tor * 0.36], [w * 0.98, -leg - tor * 0.6]);
        X.hB = hpath(X, X.hB, [w * 0.18, -leg - tor * 0.3], [w * 0.74, -leg - tor * 0.5]);
        P.holdAng = hpath(X, -0.3, 0.3, -0.04); P.gunB = hpath(X, Math.PI + 0.35, 0.35, 0.02);
        P.lean = hpath(X, 0, 0.08, -0.24);
        if (X.phase === 1) { const a = X.age % 2; P.shotF = a ? -1 : 0; P.shotB = a ? 0 : -1; }
        P.glintAt = gunMuzzle(P, X.hF, P.holdAng, false);
      },
      fx(c, f, P, hv, tk) { gunBlast(c, P, hv, gunMuzzle(P, P.hF, P.holdAng, false), P.holdAng, 34, false); },
      swing(f) { gunSmoke(f, [[52, -42], [44, -38]], 5); for (let i = 0; i < 2; i++) gunShell(f, 30, -44); },
      hit(att, e) { gunSpark(e, 9); },
    },
    // Sky shot: both pistols straight up over the hat, two flashes and two tracers going up
    hUp: {
      name: "Sky shot", linger: 14, glintCol: "#ffd27a",
      pose(X) {
        const { P, w, h, leg, tor } = X;
        X.replace = true;
        X.hF = hpath(X, X.hF, [w * 0.45, -leg - tor * 0.45], [w * 0.36, -h - 4]);
        X.hB = hpath(X, X.hB, [w * 0.1, -leg - tor * 0.45], [-w * 0.16, -h]);
        P.holdAng = hpath(X, -0.3, -0.5, -Math.PI / 2 + 0.12); P.gunB = hpath(X, Math.PI + 0.35, -0.8, -Math.PI / 2 - 0.12);
        P.lean = hpath(X, 0, 0.1, -0.08); P.crouch = Math.max(P.crouch, X.phase === 1 ? 0.18 : 0);
        if (X.phase === 1 && X.age < 2) { P.shotF = X.age; P.shotB = X.age; }
        P.glintAt = gunMuzzle(P, X.hF, P.holdAng, false);
      },
      fx(c, f, P, hv, tk) {
        gunBlast(c, P, hv, gunMuzzle(P, P.hF, P.holdAng, false), P.holdAng, 30, false);
        gunBlast(c, P, hv, gunMuzzle(P, P.hB, P.gunB, true), P.gunB, 24, false);
      },
      swing(f) { gunSmoke(f, [[14, -96], [-6, -92]], 4); },
      hit(att, e) { gunSpark(e, 8); },
    },
    // Crossfire: a crouch, one pistol fires at the floor in front, the other behind; dust jumps up on both sides
    hDown: {
      name: "Crossfire", linger: 14, glintCol: "#ffd27a",
      pose(X) {
        const { P, w, leg, tor } = X;
        X.replace = true; P.spin = 0;
        P.crouch = Math.max(P.crouch, 0.36 * (X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(X.k)));
        X.fF = [w * 0.34, 0]; X.fB = [-w * 0.26, 0];
        X.hF = hpath(X, X.hF, [w * 0.5, -leg - tor * 0.55], [w * 0.8, -leg - tor * 0.22]);
        X.hB = hpath(X, X.hB, [-w * 0.3, -leg - tor * 0.55], [-w * 0.66, -leg - tor * 0.22]);
        P.holdAng = hpath(X, -0.3, -0.2, 0.8); P.gunB = hpath(X, Math.PI + 0.35, Math.PI + 0.2, Math.PI - 0.8);
        if (X.phase === 1 && X.age < 2) { P.shotF = X.age; P.shotB = X.age; }
        P.glintAt = gunMuzzle(P, X.hF, P.holdAng, false);
      },
      fx(c, f, P, hv, tk) {
        gunBlast(c, P, hv, gunMuzzle(P, P.hF, P.holdAng, false), P.holdAng, 22, false);
        gunBlast(c, P, hv, gunMuzzle(P, P.hB, P.gunB, true), P.gunB, 22, false);
        const age = Math.max(0, hv.age + 1), a = 1 - age / 14;
        for (const sx of [1, -1]) gring(c, sx * 38, -2, 8 + age * 3.4, a, "#ffcf7a", "rgba(90,50,20,0.7)");
      },
      swing(f) { groundDust(f, [40, -40], 4); gunSmoke(f, [[40, -14], [-40, -14]], 3); },
      hit(att, e) { gunSpark(e, 8); },
    },
    // in the air: the same fanned blast with a smaller kick
    hAir: {
      name: "Fan the hammer", linger: 14, glintCol: "#ffd27a",
      pose(X) {
        const { P, w, leg, tor } = X;
        X.replace = true;
        X.hF = hpath(X, X.hF, [w * 0.42, -leg - tor * 0.5], [w * 0.98, -leg - tor * 0.62]);
        X.hB = hpath(X, X.hB, [w * 0.18, -leg - tor * 0.45], [w * 0.74, -leg - tor * 0.54]);
        P.holdAng = hpath(X, -0.3, 0.3, -0.02); P.gunB = hpath(X, Math.PI + 0.35, 0.35, 0.04);
        P.lean = hpath(X, 0, 0.08, -0.2);
        if (X.phase === 1) { const a = X.age % 2; P.shotF = a ? -1 : 0; P.shotB = a ? 0 : -1; }
        P.glintAt = gunMuzzle(P, X.hF, P.holdAng, false);
      },
      fx(c, f, P, hv, tk) { gunBlast(c, P, hv, gunMuzzle(P, P.hF, P.holdAng, false), P.holdAng, 30, false); },
      swing(f) { gunSmoke(f, [[50, -42]], 4); gunShell(f, 30, -44); },
      hit(att, e) { gunSpark(e, 8); },
    },
  },

  reaper: {
    // Reap: the scythe is drawn back behind him, then swings flat round him one full turn at the waist, front and behind
    hSide: {
      name: "Reap", linger: 8, glintCol: "#e6e9f2",
      pose(X) { reapFlat(X, -X.leg - X.tor * 0.3, 0.3, { rf: 94, rb: 68, ry: 12 }, 0.28); },
      fx(c, f, P, hv, tk) { reapTrailFx(c, f, P, hv, 12); },
      swing(f) { reapWisps(f, [[60, -40], [-50, -36]], 3); },
      hit(att, e) { reapHit(e); },
    },
    // overhead arc: from a low guard in front, up over his head and down behind, blade first
    hUp: {
      name: "Overhead arc", linger: 8, glintCol: "#e6e9f2",
      pose(X) {
        const { P, w, leg, tor } = X;
        X.replace = true; P.noSwoosh = true;
        P.crouch = Math.max(P.crouch, X.phase === 0 ? 0.3 * X.wk : X.phase === 2 ? 0.15 * (1 - ease(X.k)) : 0);
        const rest = REAP_REST(w, leg, tor), h1 = [w * 0.45, -leg - tor * 0.85], h2 = [-w * 0.05, -leg - tor * 1.0];
        X.hF = hpath(X, rest, [w * 0.5, -leg - tor * 0.15], h1, h2);
        P.holdAng = hpath(X, -1.75, 1.05, -0.3, -2.85);   // the low guard: blade down near the floor in front
        P.bladeS = hpath(X, 1, -1, -1, -1);
        P.lean = hpath(X, 0, 0.1, -0.12, -0.2);
        X.hB = reapGrip(X.hF, P.holdAng, 1, 14); X.fF = [w * 0.3, 0]; X.fB = [-w * 0.24, 0];
        X.trail = { h1, h2, a1: -0.3, a2: -2.85, s: -1 };
        P.glintAt = scyTipAt(X.hF, P.holdAng, P.bladeS, w, 1);
      },
      fx(c, f, P, hv, tk) { reapTrailFx(c, f, P, hv, 12); },
      swing(f) { reapWisps(f, [[0, -100]], 3); },
      hit(att, e) { reapHit(e); },
    },
    // grave sweep: a deep crouch, the scythe swings flat round his feet, low on both sides; dust jumps up
    hDown: {
      name: "Grave sweep", linger: 8, glintCol: "#e6e9f2",
      pose(X) { reapFlat(X, -X.leg - X.tor * 0.05, 0.46, { rf: 78, rb: 78, ry: 7 }, 0.2); },
      fx(c, f, P, hv, tk) { reapTrailFx(c, f, P, hv, 10); },
      swing(f) { groundDust(f, [52, -52], 4); },
      hit(att, e) { reapHit(e); },
    },
    // in the air: one big vertical turn, from over his head round the front and under him to behind
    hAir: {
      name: "Reap", linger: 8, glintCol: "#e6e9f2",
      pose(X) {
        const { P, w, leg, tor } = X;
        X.replace = true; P.noSwoosh = true;
        const rest = REAP_REST(w, leg, tor), h1 = [w * 0.35, -leg - tor * 0.8], h2 = [w * 0.1, -leg - tor * 0.4];
        X.hF = hpath(X, rest, [w * 0.2, -leg - tor * 1.0], h1, h2);
        P.holdAng = hpath(X, -1.75, -2.6, -1.7, 2.5); P.bladeS = 1;
        if (X.phase === 2) P.holdAng = mixv(2.5, 2 * Math.PI - 1.75, ease(X.k));   // on round over the back to the shoulder
        P.lean = hpath(X, 0, -0.15, 0.1, 0.2);
        X.hB = reapGrip(X.hF, P.holdAng, 1, 14);
        X.trail = { h1, h2, a1: -1.7, a2: 2.5, s: 1 };
        P.glintAt = scyTipAt(X.hF, P.holdAng, P.bladeS, w, 1);
      },
      fx(c, f, P, hv, tk) { reapTrailFx(c, f, P, hv, 12); },
      swing(f) { reapWisps(f, [[50, -40], [-40, -30]], 2); },
      hit(att, e) { reapHit(e); },
    },
  },
};
// Reaper's flat swings (Reap, grave sweep): wind-up behind him, one full flat turn at height y in the hit window, back to the shoulder.
// The handle foreshortens as it points towards or away from the camera; it is drawn behind the body on the far half of the turn.
function reapFlat(X, y, crouch, R, rad) {
  const { P, w, leg, tor } = X, rest = REAP_REST(w, leg, tor), cx = w * 0.2, back = Math.PI - 0.1;
  X.replace = true; P.noSwoosh = true;
  P.crouch = Math.max(P.crouch, crouch * (X.phase === 0 ? X.wk : X.phase === 1 ? 1 : 1 - ease(X.k)));
  X.fF = [w * 0.36, 0]; X.fB = [-w * 0.3, 0];
  if (X.phase === 0) {
    X.hF = lerp2(rest, [w * 0.0, y], X.wk); P.holdAng = mixv(-1.75 + Math.PI * 2, back, X.wk); P.bladeS = 1 - 1.55 * X.wk; P.scyBack = X.wk > 0.45; P.lean = -0.14 * X.wk;
  } else if (X.phase === 1) {
    const ps = back + Math.PI * 2 * X.u, cp = Math.cos(ps);
    X.hF = [cx + cp * w * rad, y + Math.sin(ps) * 3]; P.holdAng = cp >= 0 ? 0.03 : Math.PI - 0.03; P.scyK = Math.max(0.1, Math.abs(cp)); P.bladeS = -0.55; P.scyBack = Math.sin(ps) < 0; P.lean = 0.12;
  } else {
    X.hF = lerp2([cx - w * rad, y], rest, ease(X.k)); P.holdAng = mixv(back, 2 * Math.PI - 1.75, ease(X.k)); P.bladeS = mixv(-0.55, 1, ease(X.k)); P.lean = 0.12 * (1 - ease(X.k));
  }
  X.hB = reapGrip(X.hF, P.holdAng, P.scyK, 13);
  X.trail = { flat: { cx, cy: y, rf: R.rf, rb: R.rb, ry: R.ry, t1: back, t2: back + Math.PI * 2 } };
  P.glintAt = scyTipAt(X.hF, P.holdAng, P.bladeS, w, P.scyK);
}
// a heavy's trail, drawn as the swing happens (hv.sp) and fading over the linger frames
function reapTrailFx(c, f, P, hv, wmax) {
  if (!hv.trail) return;
  const N = 20, pts = scyPts(hv.trail, P.w, N), n = Math.max(2, Math.round(N * hv.sp)), a = hv.phase === 2 ? 1 - hv.post / 8 : 1;
  scyTrail(c, pts, n, wmax, a);
}
function reapWisps(f, pts, n) {
  const dark = skinLvl(f) === 3 ? "#cfc9ba" : "#4a4458";
  for (const [x, y] of pts) for (let i = 0; i < n; i++) addFx({ k: "puff", x: f.x + f.facing * (x + frand(-8, 8)), y: f.y + y + frand(-6, 6), vx: frand(-0.5, 0.5), vy: frand(-0.8, -0.2), r: frand(3, 5), t: 0, life: frand(20, 30), col: dark });
}
function reapHit(e) {
  addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 14, r0: 6, r1: 50, col: "#eef0f8" });
  burstLines(e.x, e.y, 7, ["#ffffff", "#c9cdd8"], 7);
}
// the muzzle of a pistol held at hand along a (see gunHeld), in fighter space
function gunMuzzle(P, hand, a, back) { const s = back ? 0.92 : 1, ca = Math.cos(a), sa = Math.sin(a); return [hand[0] + (18.5 * ca + 2.7 * sa) * s, hand[1] + (18.5 * sa - 2.7 * ca) * s]; }
// a heavy's blast from the muzzle at m along a: a fire cone len long in the hit window, then a grey smoke ball that drifts and fades
function gunBlast(c, P, hv, m, a, len, gold) {
  const age = Math.max(0, hv.age + 1);
  c.save(); c.translate(m[0], m[1]); c.rotate(a);
  if (hv.phase === 1) {
    const q = 1 - hv.u * 0.35, L_ = len * (0.8 + 0.25 * Math.sin(age * 2.1)) * (1 + 0.6 * HV_K);
    c.globalAlpha = 0.9; c.fillStyle = "rgba(20,15,30,0.75)";
    c.beginPath(); c.moveTo(0, -7 * q); c.quadraticCurveTo(L_ * 0.5, -12 * q, L_ + 4, 0); c.quadraticCurveTo(L_ * 0.5, 12 * q, 0, 7 * q); c.closePath(); c.fill();
    c.fillStyle = gold ? "#ffcf3d" : "#ff9a3d";
    c.beginPath(); c.moveTo(0, -5.5 * q); c.quadraticCurveTo(L_ * 0.5, -10 * q, L_, 0); c.quadraticCurveTo(L_ * 0.5, 10 * q, 0, 5.5 * q); c.closePath(); c.fill();
    c.fillStyle = "#fff4d0"; c.beginPath(); c.ellipse(L_ * 0.3, 0, L_ * 0.32, 3.2 * q, 0, 0, Math.PI * 2); c.fill();
    star4(c, 3, 0, 11 * q, "#ffffff");
  }
  const sm = hv.phase === 2 ? hv.post : 0, k = sm / 16;
  if (hv.phase === 2 && k < 1) {
    c.globalAlpha = 0.55 * (1 - k); c.fillStyle = "#cfc8d8";
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(8 + i * 7 + sm * 0.8, -sm * (0.5 + i * 0.25), 4 + i * 1.5 + sm * 0.45, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
}
// one-shot world effects: smoke puffs at muzzle points (fighter-relative [x, y]), a brass shell, sparks on a hit
function gunSmoke(f, pts, n) { for (const [x, y] of pts) for (let i = 0; i < n; i++) addFx({ k: "puff", x: f.x + f.facing * (x + frand(-4, 8)), y: f.y + y + frand(-4, 4), vx: f.facing * frand(0.2, 1.2), vy: frand(-0.9, -0.2), r: frand(3, 5.5), t: 0, life: frand(22, 34), col: "#cfc8d8" }); }
function gunShell(f, x, y) { addFx({ k: "shard", x: f.x + f.facing * x, y: f.y + y, vx: -f.facing * frand(1, 2.4), vy: frand(-3.2, -2), rot: frand(0, 6), vr: frand(-0.4, 0.4), r: 2.2, col: "#e3b54a", t: 0, life: 30, g: 0.32, damp: 0.98 }); }
function gunSpark(e, n) {
  addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 14, r0: 6, r1: 44, col: "#ffcf7a" });
  burstLines(e.x, e.y, n, ["#fff4d0", "#ffb347"], 7);
}
function greenBurst(e) {
  addFx({ k: "ring", x: e.x, y: e.y, t: 0, life: 16, r0: 8, r1: 54, col: "#7dff62" });
  addFx({ k: "star", x: e.x, y: e.y, t: 0, life: 8, s: 40 });
  burstLines(e.x, e.y, 10, ["#d9ffcf", "#55e05a"], 6.5);
}

/* ---- swoosh styles used by the looks above ---- */
// three bone-white claw marks with an accent core, drawn along a rake path as it happens
function clawRake(c, f, hv, a, b, d) {
  const pts = qpts(a, b, d, 16), n = Math.max(3, Math.round(16 * hv.sp));
  const al = hv.phase === 2 ? 1 - hv.post / 6 : 1;
  if (al <= 0) return;
  const dx = d[0] - a[0], dy = d[1] - a[1], dl = Math.hypot(dx, dy), nx = -dy / dl, ny = dx / dl;
  for (let i = -1; i <= 1; i++) {
    const off = i * 13, sh = pts.map((p) => [p[0] + nx * off, p[1] + ny * off]);
    const nn = i === 0 ? n : Math.max(3, n - 2);
    c.globalAlpha = 0.9 * al; c.fillStyle = "rgba(20,15,30,0.85)"; brush(c, sh, 11, nn);
    c.globalAlpha = al; c.fillStyle = "#f3ede2"; brush(c, sh, 7.5, nn);
    c.fillStyle = f.pal.accent; brush(c, sh, 3, nn);
  }
}
// wing-shaped orange-gold arc above the head
function wingArc(c, f, P, hv) {
  const al = hv.phase === 2 ? 1 - hv.post / 8 : 1;
  if (al <= 0) return;
  const cy = -P.h * 0.74, pts = apts(2, cy, 50, 44, -Math.PI + 0.35, -0.35, 18), n = Math.max(3, Math.round(18 * hv.sp));
  duoStroke(c, pts, n, 17, f.pal.accent, "#ffd27a", al);
  // feather notches along the outer edge
  c.globalAlpha = al; c.strokeStyle = "#ffd27a"; c.lineWidth = 2.4;
  for (let i = 3; i < Math.min(n, 16); i += 3) { const p = pts[i], an = -Math.PI + 0.35 + (Math.PI - 0.7) * (i / 18); c.beginPath(); c.moveTo(p[0] + Math.cos(an) * 8, p[1] + Math.sin(an) * 8); c.lineTo(p[0] + Math.cos(an) * 16, p[1] + Math.sin(an) * 16); c.stroke(); }
}
// low dust whips along the floor on both sides of the feet (the tail's path)
function dustArcs(c, f, P, hv, R, dustCol, accent, ink) {
  const al = hv.phase === 2 ? 1 - hv.post / 12 : 1;
  if (al <= 0 || hv.phase === 0) return;
  const t = hv.phase === 1 ? 0.5 + 0.5 * hv.u : 1, n = Math.max(3, Math.round(14 * t));
  for (const s of [1, -1]) {
    const pts = qpts([s * 8, -17], [s * R * 0.6, -2], [s * (R + 12), -9], 14);
    c.globalAlpha = (ink ? 0.9 : 0.55) * al; c.fillStyle = "rgba(20,15,30,0.8)"; brush(c, pts, ink ? 17 : 14, n);
    c.globalAlpha = al * (ink ? 0.95 : 0.7); c.fillStyle = dustCol; brush(c, pts, ink ? 11 : 8, n);
    c.fillStyle = accent; brush(c, pts, ink ? 4 : 3, n);
    if (ink) { c.globalAlpha = al; c.strokeStyle = "#ffffff"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= n; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
  }
  if (ink) return;
  c.globalAlpha = al * 0.65; c.fillStyle = dustCol;
  for (let i = 0; i < 8; i++) { const s = i % 2 ? 1 : -1, d = R * 0.6 + (hv.age + 1) * 2.4 + i * 3.5; c.beginPath(); c.arc(s * d, -6 - ((hv.age + i) % 5) * 1.3, 3 + (i % 3), 0, Math.PI * 2); c.fill(); }
}
// Samurai ink: tapered black stroke with an accent core and a white flash line
function inkStroke(c, f, pts, hv, wmax, fade) {
  const n = pts.length - 1, i1 = Math.max(2, Math.round(n * hv.sp)), a = hv.phase === 2 ? 1 - hv.post / fade : 1;
  if (a <= 0) return;
  c.globalAlpha = 0.92 * a; c.fillStyle = "rgba(20,15,30,0.9)"; brush(c, pts, wmax, i1);
  c.globalAlpha = a; c.fillStyle = f.pal.accent; brush(c, pts, wmax * 0.42, i1);
  c.globalAlpha = a * (hv.phase === 1 ? 1 : 0.7); c.strokeStyle = "#ffffff"; c.lineWidth = 1.8;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= i1; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
  c.globalAlpha = 0.8 * a; c.fillStyle = "rgba(20,15,30,0.9)";
  for (let i = 3; i < i1; i += 4) { const p = pts[i], s = i % 8 < 4 ? 1 : -1; c.beginPath(); c.arc(p[0] + 1, p[1] + s * (wmax * 0.5 + 4 + (i % 5)), 1.5 + (i % 3) * 0.6, 0, Math.PI * 2); c.fill(); }
}
// tip trail of a blade (or fists) swung round a pivot: hv.trail = { h1, h2, a1, a2, L }
function inkArc(c, f, P, hv, wmax, colr, core) {
  const T = hv.trail, L = T.L || P.w * 1.35 + 4, pts = [];
  for (let i = 0; i <= 18; i++) { const u = i / 18, h = lerp2(T.h1, T.h2, u), an = T.a1 + (T.a2 - T.a1) * u; pts.push([h[0] + Math.cos(an) * L, h[1] + Math.sin(an) * L]); }
  const n = Math.max(3, Math.round(18 * hv.sp)), a = hv.phase === 2 ? 1 - hv.post / 9 : 1;
  if (a <= 0) return;
  c.globalAlpha = 0.92 * a; c.fillStyle = "rgba(20,15,30,0.9)"; brush(c, pts, wmax, n);
  c.globalAlpha = a; c.fillStyle = colr || f.pal.accent; brush(c, pts, wmax * 0.42, n);
  c.strokeStyle = core || "#ffffff"; c.lineWidth = 1.8; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= n; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
}
function petals(c, f, hv, tk, n) {
  if (hv.phase === 0) return;
  const age = hv.age + 1, a = 1 - age / 20;
  if (a <= 0) return;
  c.fillStyle = mix(f.pal.accent, "#ffb7c9", 0.6); c.globalAlpha = a;
  for (let i = 0; i < n; i++) {
    const an = -0.4 - i * 0.55, d = 14 + age * (2.4 + (i % 3) * 0.7), x = 10 + Math.cos(an) * d * 0.8 - 8, y = -62 + Math.sin(an) * d - age * 0.6 + age * age * 0.03;
    c.save(); c.translate(x, y); c.rotate(age * 0.3 + i); c.beginPath(); c.ellipse(0, 0, 3.4, 1.9, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
}
// two concentric arcs in front of the fists
function shockArcs(c, f, hv, colr) {
  if (hv.phase === 0) return;
  const al = hv.phase === 2 ? 1 - hv.post / 14 : 1, age = hv.age + 1;
  if (al <= 0) return;
  for (const [r, w] of [[hv.b.r * 0.9 + age * 1.5, 12], [hv.b.r * 1.35 + age * 2.4, 7]]) {
    const pts = apts(hv.tx - hv.b.r * 0.45, hv.ty, r, r * 1.05, -1.0, 1.0, 12);
    duoStroke(c, pts, 12, w, f.pal.accent, colr, al * (r < hv.b.r * 1.1 ? 1 : 0.7));
  }
  c.globalAlpha = al;
  for (let i = 0; i < 4; i++) star4(c, hv.tx + 12 + age * (2 + i) , hv.ty - 22 + i * 14 + Math.sin(age + i) * 3, 5 - i * 0.6, "#ffffff");
}
function runeHit(c, f, hv, x, y, which) {
  if (hv.phase === 0) return;
  const al = hv.phase === 2 ? 1 - hv.post / 14 : 1, age = hv.age + 1;
  if (al <= 0) return;
  const s = 10 + Math.min(age, 4) * 2.2;
  c.globalAlpha = al * 0.9; c.strokeStyle = f.pal.accent; c.lineWidth = 2.6; c.beginPath(); c.arc(x, y, s + 5, 0, Math.PI * 2); c.stroke();
  c.globalAlpha = al; rune(c, x, y, s * 0.8, which, "#ffffff", 2.4);
}
// a fire arc over the head with embers raining from it
function fireArc(c, f, P, hv) {
  const al = hv.phase === 2 ? 1 - hv.post / 14 : 1;
  if (al <= 0 || hv.phase === 0) return;
  const pts = apts(2, -P.h * 0.7, 46, 40, -Math.PI + 0.3, -0.3, 18), n = Math.max(3, Math.round(18 * hv.sp));
  duoStroke(c, pts, n, 17, "#ff6a2b", "#ffe08a", al);
  const age = hv.age + 1;
  for (let i = 0; i < 9; i++) {
    const p = pts[2 + ((i * 2) % 15)], fall = age * (1.2 + (i % 3) * 0.5), q = 1 - Math.min(1, age / 18);
    c.globalAlpha = al * q; c.fillStyle = i % 2 ? "#ffe08a" : "#ff8a3d";
    c.beginPath(); c.arc(p[0] + Math.sin(i * 3 + age * 0.3) * 4, p[1] + 6 + fall * 3.2, 2.6 - (i % 3) * 0.5, 0, Math.PI * 2); c.fill();
  }
}

/* ===================== charge-up glow =====================
   A ground heavy that is held at its hold point (f.chg counts 1..BL.TUNE.chgMax) reads in three stages: wound (1-20), loaded (21-40), max (41-60).
   Stage 1: a soft glow in the accent colour at the striking limb or weapon. Stage 2: the fighter's own element gathers (CHARGE_GATHER[id]).
   Stage 3: the glow doubles, a rim light runs round the body and the body shakes 1 px (pose() sets P.jit).
   UI only: everything is a function of f.chg and the tick, so it works with a frozen sim.
   On release, P.hv.ck (= chg / chgMax) makes the heavy's strokes thicker and two-toned (see brush(), duoStroke(), drawSwoosh()).
   To change what a fighter shows: chargePts() says where the glow sits, CHARGE_GATHER[id] draws the stage 2 and 3 element. */
const bp = (P, p) => rot(p, P.hip, P.lean);   // a point on the leaning body, in fighter space
const nz = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
function glowDot(c, x, y, r, a, colr) {
  if (a <= 0 || r <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(colr, Math.min(1, a))); g.addColorStop(0.45, rgba(colr, Math.min(1, a * 0.6))); g.addColorStop(1, rgba(colr, 0));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function tongue(c, x, y, h, wd, lean, colr, core) {
  c.fillStyle = colr; c.beginPath(); c.moveTo(x - wd, y);
  c.quadraticCurveTo(x - wd * 0.9 + lean * 0.3, y - h * 0.55, x + lean, y - h); c.quadraticCurveTo(x + wd * 0.9 + lean * 0.3, y - h * 0.5, x + wd, y); c.closePath(); c.fill();
  if (core) {
    c.fillStyle = core; c.beginPath(); c.moveTo(x - wd * 0.5, y);
    c.quadraticCurveTo(x - wd * 0.4 + lean * 0.2, y - h * 0.35, x + lean * 0.7, y - h * 0.62); c.quadraticCurveTo(x + wd * 0.4 + lean * 0.2, y - h * 0.3, x + wd * 0.5, y); c.closePath(); c.fill();
  }
}
// flame tongues rising from a point, each flickering on its own
function flameCluster(c, x, y, n, h, spread, tk, q, colr, core) {
  for (let i = 0; i < n; i++) {
    const m = i - (n - 1) / 2, fl = 0.72 + 0.28 * Math.sin(tk * 0.55 + i * 2.3);
    tongue(c, x + m * spread, y, h * fl * (1 - Math.abs(m) * 0.16), 3.2 + q * 1.8, Math.sin(tk * 0.32 + i * 1.7) * 2.6, colr, core);
  }
}
// green-white forks round a point, re-rolled every other tick
function crackle(c, x, y, tk, q, r) {
  const seed = (tk >> 1) * 7.13, n = 3 + (q > 0.55 ? 2 : 0);
  c.lineJoin = "round";
  for (let i = 0; i < n; i++) {
    const a0 = nz(seed + i * 3.1) * Math.PI * 2, len = r * (0.7 + 0.8 * nz(seed + i * 5.7)), ca = Math.cos(a0), sa = Math.sin(a0), pts = [[x + ca * 4, y + sa * 4]];
    for (let j = 1; j <= 4; j++) { const t = j / 4, jt = (nz(seed + i * 9.1 + j * 2.7) - 0.5) * 9; pts.push([x + ca * (4 + len * t) - sa * jt, y + sa * (4 + len * t) + ca * jt]); }
    for (const [colr, wd] of [["rgba(160,255,140,0.5)", 4.2], ["#f1ffe6", 1.5]]) {
      c.strokeStyle = colr; c.lineWidth = wd; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.stroke();
    }
  }
}
// pale-blue breath rising off a fist, with a twinkle or two
function frost(c, x, y, tk, q, n) {
  for (let i = 0; i < n; i++) {
    const ph = (tk * 0.045 + i / n) % 1, r = 3.6 + ph * 8 * (0.75 + q * 0.5), px = x + Math.sin(i * 4.1 + tk * 0.03) * 9, py = y - 3 - ph * 26;
    c.globalAlpha = (1 - ph) * 0.85; c.fillStyle = i % 2 ? "#e9f8ff" : "#b9e3ff";
    c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
    if (i % 2 === 0) star4(c, px + 7, py - 6, 1.6 + 4 * (1 - ph), "#ffffff");
  }
  c.globalAlpha = 1;
}
// motes spiralling up off a point (the Wizard's crystal)
function motes(c, x, y, tk, q, n) {
  for (let i = 0; i < n; i++) {
    const ph = (tk * 0.04 + i / n) % 1, ang = i * 2.4 + tk * 0.09, rr = 7 + 11 * ph;
    c.globalAlpha = Math.min(1, (1 - ph) * 1.4);
    star4(c, x + Math.cos(ang) * rr * 1.3, y - 3 - ph * 30 + Math.sin(ang) * 4, 2.4 + 2.4 * (1 - ph) * (0.6 + q * 0.6), i % 2 ? "#fff6d8" : "#bff3ff");
  }
  c.globalAlpha = 1;
}
// a white glint sliding hilt to tip along the blade
function bladeGlint(c, f, P, tk, st, q) {
  const sh = bp(P, P.sh), a = heldDir(f, P, sh, -0.8), L = P.w * 1.35, ca = Math.cos(a), sa = Math.sin(a), n = st === 3 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const t = (tk * 0.032 + i * 0.5) % 1, d = 8 + t * (L - 10), x = P.hF[0] + ca * d, y = P.hF[1] + sa * d, fade = Math.sin(Math.PI * t);
    c.globalAlpha = 0.35 * fade; c.strokeStyle = "#ffffff"; c.lineWidth = 3; c.beginPath(); c.moveTo(x - ca * 9, y - sa * 9); c.lineTo(x + ca * 9, y + sa * 9); c.stroke();
    c.globalAlpha = Math.min(1, 0.4 + fade); star4(c, x, y, 7 + 7 * fade * (0.7 + q * 0.5), "#ffffff");
  }
  c.globalAlpha = 1;
}
// where the stage 1 glow sits: the striking limb or weapon
function chargePts(f, P, key) {
  const hand = P.hF, foot = P.fF;
  switch (f.spec.id) {
    case "phoenix": return key === "hSide" ? [bp(P, P.mouthPt || P.head)] : key === "hUp" ? [hand] : [foot];
    case "alchemist": return [hand];
    case "odin": return key === "hUp" ? [hand] : [hand, P.hB];
    case "wizard": return [P.staffTip || hand];
    case "samurai": { const a = heldDir(f, P, bp(P, P.sh), -0.8), L = P.w * 1.35; return [hand, [hand[0] + Math.cos(a) * L * 0.6, hand[1] + Math.sin(a) * L * 0.6]]; }
    case "reaper": return [P.scyTip || hand];
    case "gunslinger": return [gunMuzzle(P, hand, heldDir(f, P, bp(P, P.sh), -0.3), false), gunMuzzle(P, P.hB, P.gunB != null ? P.gunB : Math.PI + 0.35, true)];
    default: return key === "hUp" ? [hand, bp(P, [-P.w * 0.05 - 9, P.top - 14])] : key === "hDown" ? [hand, P.hB] : [hand];   // dragon: claws (and the horns for the toss)
  }
}
// stage 2 and 3: the element gathers. q = progress through the stage (0..1)
const CHARGE_GATHER = {
  phoenix(c, f, P, tk, st, q) { const o = bp(P, [-P.w * 0.1, P.top + P.ry * 0.25]); flameCluster(c, o[0], o[1], st === 3 ? 5 : 3, 15 + 10 * q + (st === 3 ? 8 : 0), 6, tk, q, "#ff7a2b", "#ffe08a"); },
  dragon(c, f, P, tk, st, q, pts) { for (const p of pts) flameCluster(c, p[0], p[1] - 1, st === 3 ? 4 : 3, 11 + 6 * q + (st === 3 ? 6 : 0), 4.4, tk, q, "#ff8a2b", "#ffe08a"); },
  alchemist(c, f, P, tk, st, q, pts) { for (const p of pts) crackle(c, p[0], p[1], tk, st === 3 ? 1 : q * 0.5, 20 + 10 * q + (st === 3 ? 10 : 0)); },
  odin(c, f, P, tk, st, q, pts) { for (const p of pts) frost(c, p[0], p[1], tk, st === 3 ? 1 : q, st === 3 ? 6 : 4); },
  wizard(c, f, P, tk, st, q, pts) {
    const [x, y] = pts[0], fl = Math.sin(tk * 0.3) * 2;
    star4(c, x, y, 14 + 8 * q + (st === 3 ? 10 : 0) + fl, "#fff6d8");   // the crystal flares
    if (st === 3) { c.globalAlpha = 0.8; c.fillStyle = "#bff3ff"; c.fillRect(x - 0.9, y - 26, 1.8, 52); c.fillRect(x - 26, y - 0.9, 52, 1.8); c.globalAlpha = 1; }
    motes(c, x, y, tk, q, st === 3 ? 7 : 5);
  },
  samurai(c, f, P, tk, st, q) { bladeGlint(c, f, P, tk, st, q); },
  reaper(c, f, P, tk, st, q, pts) { for (const [x, y] of pts) motes(c, x, y, tk, q, st === 3 ? 6 : 4); },   // pale soul motes rise off the blade
  gunslinger(c, f, P, tk, st, q, pts) {   // the barrels heat up: an orange glow and sparks that spit off the muzzles
    for (const [x, y] of pts) {
      glowDot(c, x, y, 9 + 6 * q + (st === 3 ? 5 : 0), 0.8, "#ff9a3d");
      for (let i = 0; i < (st === 3 ? 5 : 3); i++) { const ph = (tk * 0.11 + i / 5 + nz(i * 4.1)) % 1, an = nz(i * 7.7 + (tk >> 3)) * Math.PI * 2, d = 4 + ph * (10 + 8 * q); c.globalAlpha = 1 - ph; star4(c, x + Math.cos(an) * d, y + Math.sin(an) * d, 3.5 - ph * 2, i % 2 ? "#fff4d0" : "#ffcf7a"); }
      c.globalAlpha = 1;
    }
  },
};
function drawCharge(c, f, P, tk) {
  if (!P.hold || P.chg <= 0 || !P.rx || !P.hv) return;
  const n = P.chg, st = n > 40 ? 3 : n > 20 ? 2 : 1, q = st === 1 ? n / 20 : st === 2 ? (n - 20) / 20 : 1;
  const acc = f.spec.look.costume === "reaper" ? "#dfe3ee" : f.pal.accent, ramp = Math.min(1, n / 4), pulse = 0.88 + 0.12 * Math.sin(tk * 0.5);   // the Reaper's grey hood would make a dark glow
  const a = st === 1 ? 0.55 + 0.25 * q : st === 2 ? 0.7 + 0.2 * q : 1, r = (st === 1 ? 20 + 8 * q : st === 2 ? 28 + 8 * q : 40) * pulse;
  const pts = chargePts(f, P, P.hv.key);
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  if (st === 3) {
    // rim light round the whole body
    c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean); c.translate(-P.hip[0], -P.hip[1]);
    c.globalAlpha = 0.22 + 0.1 * Math.sin(tk * 0.6); c.strokeStyle = acc; c.lineWidth = 8; c.beginPath(); c.ellipse(0, P.cy, P.rx + 2, P.ry + 2, 0, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
  for (const p of pts) {
    glowDot(c, p[0], p[1], r, a * ramp, acc);
    glowDot(c, p[0], p[1], r * (st === 3 ? 0.5 : 0.4), (st === 3 ? 0.85 : 0.55) * ramp, f.spec.look.costume === "reaper" ? "#ffffff" : mix(acc, "#ffffff", 0.65));   // (mix() returns rgb(), which glowDot reads as black; the Reaper passes a hex)   // a pale core, so the glow reads on a body of the same colour
  }
  if (st >= 2 && CHARGE_GATHER[f.spec.id]) { c.globalAlpha = 1; CHARGE_GATHER[f.spec.id](c, f, P, tk, st, q, pts); }
  if (f.spec.look.costume === "reaper") { c.globalAlpha = 1; reapReach(c, f, P, tk); }   // the scythe's reach, from the first charge frame
  c.restore();
}

/* ===================== finish-ready: the fighter side =====================
   While the opponent is at BL.TUNE.finishPct or more, Samurai's Quick Draw leaves the white flash line (the world-space part is finDashTick in effects.js;
   the projectiles and the ring under the feet are in draw-world.js). */
function drawFinishFx(c, f, P, tk) {
  const m = f.move;
  if (f.spec.look.costume !== "samurai" || f.state !== "attack" || !m || m.kind !== "dash" || !finishReady(foeSlot(f.slot))) return;
  if (f.mt < m.startup + 1 || f.mt > m.startup + m.active) return;   // after the dash the finDashTick line takes over
  const dist = Math.min(260, (m.speed || 15) * (f.mt - m.startup)), y = -P.h * 0.45, pts = lpts([-dist - 6, y], [-6, y], 8);
  c.save(); c.lineCap = "round";
  c.globalAlpha = 0.5; c.fillStyle = f.pal.accent; brush(c, pts, 15, 8);
  c.globalAlpha = 1; c.fillStyle = "#ffffff"; brush(c, pts, 5, 8);
  c.restore();
}

/* ===================== Ultimates: the looks of the eight ulti moves (UI only) =====================
   During an ulti f.state === "attack", f.mid === "ulti", f.mt is the frame and f.move.ult the kind (see docs / interface notes):
   dive (Phoenix) · cloud (Alchemist) · spear (Odin) · stars (Wizard) · cuts (Samurai) · hellfire (Dragon) · deadeye (Gunslinger) · harvest (Reaper).
   Poses come from ultPose() (called from pose(); the Reaper's is in reaperPose, the Gunslinger's in gunShotPose), props held in the hand from
   uvHeldProp() (inside drawPotato, fighter space), what is behind / over the figure from uvBehind / uvAhead (drawFighter) and uvFront
   (render2D, world space), the marks on the floor from uvFloor (draw-world.js), particles and sounds once per sim tick from uvFighterTick. */
const UV_RISE = 26;   // Phoenix rises 26 px a tick (core.js ultStep)
// the Dragon is drawn 1.6x from his feet while he works: grows in the wind-up (and through the freeze), holds, shrinks in the end lag
function uvScale(f) {
  if (uvHeld(f) !== "hellfire") return 1;
  const live = UV.g && UV.g.fighters[f.slot] === f, e = live ? (UV.t < UV_FREEZE ? UV.t * 0.4 : 12) : 0;
  return 1 + 0.6 * ease(clamp((f.mt + e) / 26, 0, 1)) * (1 - ease(clamp((f.mt - 70) / 28, 0, 1)));
}
// the camera keeps Phoenix's dive on the stage instead of following him out of the top of the screen
function uvCamY(f) { return uvHeld(f) === "dive" ? Math.max(f.y, -120) : f.y; }
function uvHidden(f) { return uvHeld(f) === "dive" && f.mt >= 15 && f.mt < 31; }   // above the screen: nothing of him is drawn, the mark on the floor says where
// the alpha of the figure during an ulti (the intangible flicker would run through most of Phoenix's and the Samurai's moves)
function uvAlpha(f) { return uvHeld(f) === "cuts" && f.mt >= 24 && f.mt <= 36 ? 0.3 : 1; }
// how far into the super freeze the user's power pose is (0..1); 1 outside the freeze
function uvFz(f) { return f.mt === 0 && UV.g && UV.g.fighters[f.slot] === f ? clamp(UV.t / 10, 0, 1) : 1; }
// the crystal of the Wizard's staff in the world (where his stars are called from)
function staffTip(f, tk) {
  const P = pose(f, tk), a = P.holdAng != null ? P.holdAng : -Math.PI / 2 + 0.12;
  return [f.x + f.facing * (P.hF[0] + Math.cos(a) * 40), f.y + P.hF[1] + Math.sin(a) * 40];
}

function drawFighter(c, f, tk, at) {
  if (f.spec.boss) return drawBoss(c, f, tk, at);   // a boss has his own drawing (ui/draw-boss.js)
  if (!at && uvHeld(f)) {
    if (uvHidden(f)) return;
    uvBehind(c, f, tk);
    drawFighter0(c, f, tk, at);
    uvAhead(c, f, tk);
    return;
  }
  drawFighter0(c, f, tk, at);
}

/* ---- poses ---- */
// called from pose() for every ulti but the Reaper's (that is reaperPose). cur holds the hands and feet as pose() has them so far;
// S(hF, hB, fF, fB) hands new ones back. At f.mt === 0 the game is held (the super freeze): every fighter strikes a power pose.
function ultPose(f, P, m, phase, k, w, leg, tor, cur, set) {
  const mt = f.mt, cos = f.spec.look.costume, hand = (x, y) => [w * x, -leg - tor * y];
  const S = (a, b, c2, d) => { if (a) cur.hF = a; if (b) cur.hB = b; if (c2) cur.fF = c2; if (d) cur.fB = d; set(a, b, c2, d); };
  const fz = ease(uvFz(f)), fzF = hand(0.55, 1.28);
  P.noSwoosh = true;
  if (mt === 0 && cos !== "gunslinger") {   // a fist to the sky, knees bent
    P.crouch = 0.2 * fz; P.lean = -0.1 * fz;
    S(lerp2(cur.hF, fzF, fz), lerp2(cur.hB, hand(-0.55, 0.5), fz), lerp2(cur.fF, [w * 0.45, 0], fz), lerp2(cur.fB, [-w * 0.4, 0], fz));
  }
  switch (cos) {
    case "phoenix":
      if (mt === 0) { P.wingUp = fz; S(lerp2(cur.hF, hand(0.95, 0.35), fz), lerp2(cur.hB, hand(-0.8, 0.3), fz)); }                           // braced, wings flared
      else if (mt < 15) { P.wingUp = 1.2; P.crouch = 0; P.lean = 0; S(hand(0.28, 1.25), hand(-0.2, 1.2), [w * 0.1, -leg * 0.1], [-w * 0.12, -leg * 0.15]); }   // rising: arms up, feet together
      else if (mt >= 31 && mt < 60) { P.spin = Math.PI + Math.sin(tick * 0.5) * 0.12; P.wingUp = 0.3; S(hand(0.22, 0.15), hand(-0.2, 0.12)); }   // the dive: head first
      else if (mt >= 60) {   // the landing: swings upright into a crouch, arms wide, the crouch rises again
        const q = ease(clamp((mt - 59) / 6, 0, 1)), r = ease(clamp((mt - 66) / 24, 0, 1));
        P.spin = Math.PI * (1 - q); P.crouch = 0.5 * (1 - r); P.wingUp = 1 - 0.5 * r; P.lean = 0;
        S(hand(1.0, 0.38), hand(-0.9, 0.35), [w * 0.55, 0], [-w * 0.5, 0]);
      }
      break;
    case "alchemist":   // the flask goes up and back over the head, then the usual throw
      if (phase === 0 && mt > 0) { const q = ease(Math.min(1, k * 1.5)); P.crouch = 0.2 + 0.08 * q; P.lean = -0.1 - 0.04 * q; S(lerp2(fzF, hand(-0.15, 1.42), q)); }
      break;
    case "odin":        // the spear is raised, then drawn back behind the shoulder (uvHeldProp draws it)
      if (mt === 0) P.holdAng = -1.1;
      else if (phase === 0) { const q = ease(Math.min(1, k * 1.4)); P.crouch = 0.2 + 0.04 * q; P.lean = -0.1 - 0.08 * q; S(lerp2(fzF, hand(-0.55, 0.95), q)); P.holdAng = lerp(-1.1, -0.1, q); }
      break;
    case "wizard": {    // the staff held up, the crystal flares on every star he calls
      const up = phase === 2 ? 1 - ease(k) : 1, call = mt >= 6 && mt <= 42 ? Math.max(0, 1 - ((mt - 6) % 8) / 5) : 0;
      S(lerp2(cur.hF, hand(0.45, 1.3), up)); P.holdAng = -1.45; P.cryK = 1.35 + 0.35 * Math.sin(tick * 0.4) + 1.1 * call; P.lean = -0.07 * up; P.crouch = 0.12 * up;
      break;
    }
    case "samurai": {
      if (mt <= 23) {   // crouched, the front hand on the hilt, the scabbard back; trembling for the last frames
        const q = mt === 0 ? fz : 1;
        P.crouch = 0.46 * q; P.lean = 0.18 * q; P.holdAng = lerp(-0.8, Math.PI - 0.5, q); P.sheath = q > 0.15 ? 1 : 0;
        S(lerp2(cur.hF, hand(0.1, 0.3), q), lerp2(cur.hB, hand(-0.45, 0.3), q), lerp2(cur.fF, [w * 0.45, 0], q), lerp2(cur.fB, [-w * 0.4, 0], q));
        if (mt > 15) P.jit = [(tick & 1 ? 1 : -1) * 0.9 * ((mt - 15) / 8), 0];
      } else if (mt <= 35) P.sheath = 0;   // the dash (the classic dash pose)
      else if (mt < 54) { P.crouch = 0.32; P.lean = 0.1; P.holdAng = 0.1; P.sheath = 0; S(hand(0.75, 0.38), hand(-0.4, 0.4), [w * 0.5, 0], [-w * 0.4, 0]); }   // through, blade low
      else if (mt <= 66) {   // the blade slides home: the click is frame 66
        const q = ease(clamp((mt - 54) / 12, 0, 1));
        P.crouch = 0.32 - 0.1 * q; P.lean = 0.1; P.holdAng = lerp(0.1, Math.PI - 0.5, q); P.sheath = q;
        S(lerp2(hand(0.75, 0.38), hand(0.1, 0.3), q), hand(-0.4, 0.4), [w * 0.5, 0], [-w * 0.4, 0]);
      } else { P.crouch = 0.22 * (1 - ease(clamp((mt - 66) / 14, 0, 1))); P.lean = 0.05; P.holdAng = Math.PI - 0.5; P.sheath = 1; S(hand(0.1, 0.3), hand(-0.4, 0.35)); }
      break;
    }
    case "dragon": {    // the wings spread as he grows and fold in the end lag
      const base = 0.35 * (mt === 0 ? fz : 1);
      P.wingUp = phase === 0 ? base + 0.65 * ease(k) : phase === 1 ? 1 : 1 - ease(k);
      S(null, null, [w * 0.34, 0], [-w * 0.3, 0]);   // both feet planted (the move's second hitbox would fling the back foot out along the fire)
      break;
    }
    case "gunslinger": P.crouch = 0.08; break;
  }
}
/* ---- what the figure holds ---- */
function uvHeldProp(c, f, P, tk) {
  const mt = f.mt, cos = f.spec.look.costume;
  if (cos === "alchemist" && mt < 24) {   // the flask: it shakes and glows, green sparks climb off it
    const [hx, hy] = P.hF, q = Math.min(1, mt / 20), sh = mt > 8 ? Math.sin(tk * 1.3) * 0.12 * q : 0;
    glowDot(c, hx + 3, hy - 12, 20 + 14 * q, 0.55 + 0.3 * q, "#7dff62");
    flaskShape(c, hx + 3, hy - 10, 1.35 + 0.2 * q, sh, "#7dff62");
    for (let i = 0; i < 3; i++) { const ph = (tk * 0.05 + i / 3) % 1; c.globalAlpha = 1 - ph; c.fillStyle = "#d4ffbc"; c.beginPath(); c.arc(hx + 3 + Math.sin(i * 3 + tk * 0.2) * 6, hy - 22 - ph * 22, 2.4, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
  } else if (cos === "odin" && mt < 26) {   // Gungnir in the hand, tip forward, runes lit
    c.save(); c.translate(P.hF[0], P.hF[1]); c.rotate(P.holdAng != null ? P.holdAng : -0.3); c.translate(-10, 0); c.scale(0.72, 0.72);
    uvSpearShape(c, tk);
    c.restore();
    c.fillStyle = LIMB; c.beginPath(); c.arc(P.hF[0], P.hF[1], 4.6, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();   // the fist over the shaft
  } else if (cos === "samurai" && mt >= 16 && mt <= 23) {   // a white glint on the hilt just before the dash
    const q = (mt - 15) / 8, [hx, hy] = P.hF;
    glowDot(c, hx, hy, 16 + 14 * q, 0.7, "#ffffff"); star4(c, hx, hy, 7 + 12 * q, "#ffffff");
  }
}
function uvBehind(c, f, tk) {
  const k = uvHeld(f), mt = f.mt, cy = f.y - f.s.h * 0.5 * uvScale(f);
  if (k === "dive") {
    if (mt >= 1 && mt < 15) glowDot(c, f.x, cy, 78, 0.7, "#ff8a2b");
    else if (mt >= 31 && mt < 60) uvPhoenixComet(c, f, tk, true);
  } else if (k === "cuts" && mt >= 24 && mt <= 40) {   // afterimages: the accent-coloured silhouettes of where he just was
    const d = f.facing, fade = mt <= 35 ? 1 : 1 - (mt - 35) / 5, sil = uvSil(f, tk, f.pal.accent), S = UV_SIL.S;
    for (let i = 1; i <= 5; i++) { c.globalAlpha = 0.5 * (1 - i / 6) * fade; c.drawImage(sil, f.x - d * 22 * i * (mt <= 35 ? 1 : 0.6) - S / 2, f.y - S * 0.8); }
    c.globalAlpha = 1;
  } else if (k === "deadeye" && mt >= 1 && mt < 96) {   // the red of the dead eye round him
    const a = clamp(mt / 8, 0, 1) * clamp((96 - mt) / 12, 0, 1);
    glowDot(c, f.x, cy, 96, (0.42 + 0.1 * Math.sin(tk * 0.4)) * a, "#ff2a2a");
  } else if (k === "harvest" && mt >= 1 && mt <= 72) {   // a pale ghost-green light under the hood
    const a = clamp(mt / 6, 0, 1) * clamp((72 - mt) / 10, 0, 1);
    glowDot(c, f.x, cy, 84, 0.3 * a, "#bfffe0");
  }
}
function uvAhead(c, f, tk) {
  const k = uvHeld(f), mt = f.mt;
  if (k === "dive" && mt >= 31 && mt < 60) uvPhoenixComet(c, f, tk, false);
}

/* ---- Phoenix: Solar Dive ---- */
// the flame column he rises in (a tapered, wavering column, white-gold at his feet, red and clear at the bottom)
function uvColumn(c, x, yTop, yBot, a, tk) {
  const h = yBot - yTop;
  if (h < 6 || a <= 0) return;
  c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = a;
  const layer = (w0, w1, c0, c1, c2, ph) => {
    const g = c.createLinearGradient(0, yTop, 0, yBot); g.addColorStop(0, c0); g.addColorStop(0.35, c1); g.addColorStop(1, c2);
    c.fillStyle = g; c.beginPath();
    for (let i = 0; i <= 10; i++) { const u = i / 10, y = yTop + h * u, hw = w0 + (w1 - w0) * u, wob = Math.sin(tk * 0.8 + u * 9 + ph) * (2 + 4 * u); c.lineTo(x - hw + wob, y); }
    for (let i = 10; i >= 0; i--) { const u = i / 10, y = yTop + h * u, hw = w0 + (w1 - w0) * u, wob = Math.sin(tk * 0.8 + u * 9 + ph + 2) * (2 + 4 * u); c.lineTo(x + hw + wob, y); }
    c.closePath(); c.fill();
  };
  layer(30, 8, "rgba(255,236,160,0.95)", "rgba(255,130,40,0.7)", "rgba(255,60,20,0)", 0);
  layer(14, 3, "rgba(255,255,230,1)", "rgba(255,210,100,0.8)", "rgba(255,150,50,0)", 1.3);
  c.restore();
}
// the comet: a long trail up the sky, a fireball with a gold core. `back` draws the trail and the outer fire (behind the figure), else the bright core in front
function uvPhoenixComet(c, f, tk, back) {
  const x = f.x, y = f.y - 34;
  if (back) {
    const tl = 360;
    c.save(); c.globalCompositeOperation = "lighter";
    const g = c.createLinearGradient(0, y, 0, y - tl); g.addColorStop(0, "rgba(255,244,190,0.95)"); g.addColorStop(0.2, "rgba(255,170,60,0.75)"); g.addColorStop(0.6, "rgba(255,90,30,0.35)"); g.addColorStop(1, "rgba(255,60,20,0)");
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 34, y);
    for (let i = 0; i <= 10; i++) { const u = i / 10; c.lineTo(x - 34 * (1 - u * 0.85) + Math.sin(tk * 0.9 + u * 8) * 5 * u, y - tl * u); }
    for (let i = 10; i >= 0; i--) { const u = i / 10; c.lineTo(x + 34 * (1 - u * 0.85) + Math.sin(tk * 0.9 + u * 8 + 2) * 5 * u, y - tl * u); }
    c.closePath(); c.fill();
    const g2 = c.createLinearGradient(0, y, 0, y - tl * 0.7); g2.addColorStop(0, "rgba(255,255,235,0.95)"); g2.addColorStop(1, "rgba(255,230,140,0)");
    c.fillStyle = g2; c.beginPath(); c.moveTo(x - 13, y); c.lineTo(x, y - tl * 0.7); c.lineTo(x + 13, y); c.closePath(); c.fill();
    glowDot(c, x, y, 78, 0.85, "#ff7a2b");
    c.restore();
    for (let i = 0; i < 3; i++) { const ph = (tk * 0.12 + i / 3) % 1; c.fillStyle = "#ffe08a"; c.globalAlpha = 1 - ph; c.beginPath(); c.arc(x + (nz(i * 4.1 + (tk >> 2)) - 0.5) * 50, y - 20 - ph * 140, 3, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
  } else {
    c.save(); c.globalCompositeOperation = "lighter";
    glowDot(c, x, y, 52, 0.7, "#ffd23f"); glowDot(c, x, y, 24, 0.95, "#fff6c8");   // the gold core
    c.restore();
    star4(c, x, y, 20 + 5 * Math.sin(tk * 0.7), "rgba(255,255,255,0.85)");
  }
}
// the mark on the floor where he will land (drawn under the fighters from the moment he is out of sight until he lands, mt 15..59)
function uvPhoenixMark(c, f, tk) {
  const mt = f.mt;
  if (mt < 15 || mt >= 60) return;
  const x = f.ultX, ty = uvFloorY(f), age = mt - 15, fadeIn = clamp(age / 5, 0, 1), urg = mt >= 31 ? 1 : 0.55 + 0.45 * (age / 16), pul = 0.5 + 0.5 * Math.sin(tk * 0.45);
  c.save(); c.translate(x, 0);
  c.globalAlpha = fadeIn; c.globalCompositeOperation = "lighter";
  const sw = 36 + 8 * pul + (mt >= 31 ? 14 : 0), g = c.createLinearGradient(0, ty - 900, 0, ty);   // the light shaft from above
  g.addColorStop(0, "rgba(255,230,140,0)"); g.addColorStop(0.65, `rgba(255,205,90,${0.08 * urg})`); g.addColorStop(1, `rgba(255,236,170,${0.24 * urg})`);
  c.fillStyle = g; c.fillRect(-sw, ty - 900, sw * 2, 900);
  const g2 = c.createLinearGradient(0, ty - 900, 0, ty); g2.addColorStop(0, "rgba(255,255,255,0)"); g2.addColorStop(1, `rgba(255,255,255,${0.16 * urg})`);
  c.fillStyle = g2; c.fillRect(-sw * 0.38, ty - 900, sw * 0.76, 900);
  c.globalCompositeOperation = "source-over";
  c.translate(0, ty);
  c.save(); c.scale(1, 0.26);   // the glowing disc, the size of the blast
  const rg = c.createRadialGradient(0, 0, 8, 0, 0, 100); rg.addColorStop(0, `rgba(255,238,170,${0.7 * urg})`); rg.addColorStop(0.6, `rgba(255,150,50,${0.38 * urg})`); rg.addColorStop(1, "rgba(255,100,30,0)");
  c.fillStyle = rg; c.beginPath(); c.arc(0, 0, 100, 0, Math.PI * 2); c.fill(); c.restore();
  c.lineWidth = 3.6; c.strokeStyle = UV_GOLD; c.globalAlpha = fadeIn * 0.95;   // the ring at the blast's reach (about 76 each side)
  const r1 = 78 + 3 * pul; c.beginPath(); c.ellipse(0, 0, r1, r1 * 0.26, 0, 0, Math.PI * 2); c.stroke();
  const cp = (tk % 26) / 26, r2 = 78 + 74 * (1 - cp);   // a ring closing in, over and over
  c.globalAlpha = fadeIn * (1 - cp) * 0.9; c.lineWidth = 2.4; c.strokeStyle = "#ffffff"; c.beginPath(); c.ellipse(0, 0, r2, r2 * 0.26, 0, 0, Math.PI * 2); c.stroke();
  c.globalAlpha = fadeIn * 0.7; c.lineWidth = 2; c.strokeStyle = "#ffd9a0"; c.beginPath(); c.ellipse(0, 0, 44, 11.4, 0, 0, Math.PI * 2); c.stroke();
  c.restore();
}
function uvPhoenixFront(c, f, tk) {
  const mt = f.mt;
  if (mt >= 1 && mt < 15) {   // the column from where he left the floor up to him
    const y0 = f.y + UV_RISE * mt;
    uvColumn(c, f.x, f.y + 8, y0 + 6, 1, tk);
    if (mt < 8) { c.save(); c.translate(f.x, y0 + 4); c.scale(1, 0.26); glowDot(c, 0, 0, 80, 0.75 * (1 - mt / 8), "#ffb04a"); c.restore(); }
  } else if (mt >= 15 && mt < 25) {   // what he leaves behind: the column over the spot, reaching into the sky, dying down
    const at = UV.at[f.slot];
    if (at) uvColumn(c, at.x, at.y - 720, at.y + 6, 1 - (mt - 15) / 10, tk);
  } else if (mt >= 60 && mt <= 74) {   // the landing: flame jets across the blast and a hot line on the floor
    const q = (mt - 60) / 14, a = 1 - q, env = clamp((mt - 59) / 2, 0, 1) * a;
    c.save(); c.globalCompositeOperation = "lighter";
    for (let i = -4; i <= 4; i++) flameCluster(c, f.x + i * 22, f.y + 2, 3, (74 + 54 * nz(i * 3.3)) * (1 - Math.abs(i) * 0.1) * env, 5, tk + i * 5, 1, "rgba(255,120,36,0.9)", "rgba(255,240,170,0.95)");
    const fl = c.createLinearGradient(f.x - 120, 0, f.x + 120, 0); fl.addColorStop(0, "rgba(255,200,90,0)"); fl.addColorStop(0.5, `rgba(255,236,170,${0.85 * a})`); fl.addColorStop(1, "rgba(255,200,90,0)");
    c.fillStyle = fl; c.fillRect(f.x - 120, f.y - 3, 240, 7);   // a hot line along the floor
    c.restore();
  }
}

/* ---- Dragon: Hellfire ---- */
// a flame stream from (ox, oy) to (ex, ey): three layers (red-orange, orange-yellow, white-hot core) whose edges ripple on their own phases; hw1 = half thickness at the far end
function uvFlameStream(c, ox, oy, ex, ey, hw1, tk) {
  const N = 16, L = Math.hypot(ex - ox, ey - oy), ang = Math.atan2(ey - oy, ex - ox);
  c.save(); c.translate(ox, oy); c.rotate(ang);
  const layer = (wk, c0, c1, c2, ph) => {
    const g = c.createLinearGradient(0, 0, L, 0); g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c2);
    c.fillStyle = g; c.beginPath();
    for (let i = 0; i <= N; i++) { const u = i / N, hw = (5 + (hw1 - 5) * Math.pow(u, 0.7)) * wk; c.lineTo(u * L, -hw + Math.sin(tk * 0.9 - u * 11 + ph) * (2 + 5 * u)); }
    c.lineTo(L + hw1 * 0.35 * wk, 0);
    for (let i = N; i >= 0; i--) { const u = i / N, hw = (5 + (hw1 - 5) * Math.pow(u, 0.7)) * wk; c.lineTo(u * L, hw + Math.sin(tk * 0.9 - u * 11 + ph + 2.1) * (2 + 5 * u)); }
    c.closePath(); c.fill();
  };
  layer(1, "rgba(255,226,130,0.95)", "rgba(255,120,36,0.84)", "rgba(220,50,20,0.5)", 0);
  layer(0.62, "rgba(255,248,200,0.96)", "rgba(255,196,80,0.9)", "rgba(255,120,40,0.62)", 1.7);
  layer(0.3, "rgba(255,255,240,0.98)", "rgba(255,240,170,0.9)", "rgba(255,200,90,0.5)", 3.1);
  c.restore();
}
function uvMouthWorld(f, tk) {
  const P = pose(f, tk), m = rot(P.mouthPt || [P.head[0] + P.hr * 1.5, P.head[1] + P.hr * 0.25], P.hip, P.lean), s = uvScale(f);
  return [f.x + f.facing * m[0] * s, f.y + m[1] * s];
}
function uvDragonFire(c, f, tk) {
  const mt = f.mt, d = f.facing;
  if (mt < 25 || mt > 73) return;
  const blast = mt >= 61 && mt <= 66, len = mt <= 66 ? 408 * easeOut2(clamp((mt - 24) / 6, 0, 1)) : 408 * Math.max(0, 1 - (mt - 66) / 7);
  if (len < 12) return;
  const [ox, oy] = uvMouthWorld(f, tk), ex = f.x + d * len, ey = f.y - 50;
  // the floor under the stream glows
  c.save(); c.globalCompositeOperation = "lighter";
  const fg = c.createLinearGradient(f.x, 0, ex, 0); fg.addColorStop(0, "rgba(255,150,50,0.35)"); fg.addColorStop(1, "rgba(255,90,30,0.12)");
  c.fillStyle = fg; c.fillRect(Math.min(f.x + d * 50, ex), f.y - 5, Math.abs(ex - f.x - d * 50), 9);
  c.restore();
  c.save(); c.globalAlpha = mt > 66 ? Math.max(0, 1 - (mt - 66) / 7) : 1;
  uvFlameStream(c, ox, oy, ex, ey, blast ? 64 : 46, tk);
  // tongues licking up off the top edge of the stream
  for (let i = 0; i < 5; i++) { const u = 0.25 + i * 0.17, x = ox + (ex - ox) * u, y = oy + (ey - oy) * u - 26 * u; flameCluster(c, x, y, 1, (16 + 14 * u) * (1 + (blast ? 0.5 : 0)), 0, tk + i * 7, 0.6, "rgba(255,140,40,0.8)", "rgba(255,230,150,0.9)"); }
  if (blast) {   // the blast: the far end flares white-hot
    c.globalCompositeOperation = "lighter";
    glowDot(c, ex - d * 30, ey, 110 + 20 * Math.sin(tk * 0.8), 0.9, "#ffcf6a"); glowDot(c, ex - d * 30, ey, 50, 1, "#ffffff");
  }
  c.restore();
}

/* ---- Samurai: Thousand Cuts ---- */
function uvSamuraiFront(c, g, f, tk) {
  const mt = f.mt, d = f.facing;
  if (mt >= 24 && mt <= 46) {   // the streak he left through the dash: a white blade of light from where he started to where he is
    const x0 = UV.dash[f.slot] ? UV.dash[f.slot].x : f.x - d * 264, a = mt <= 35 ? 1 : 1 - (mt - 35) / 11, y = f.y - 34, len = Math.abs(f.x - x0);
    if (len > 8) {
      const pts = lpts([x0, y], [f.x, y], 10);
      c.save(); c.globalAlpha = 0.5 * a; c.fillStyle = f.pal.accent; brush(c, pts, 34, 10);
      c.globalAlpha = 0.9 * a; c.fillStyle = "#ffffff"; brush(c, pts, 12, 10); c.restore();
    }
  }
  const t = f.ultTgt >= 0 ? g.fighters[f.ultTgt] : null;
  if (t && mt >= 30 && mt < 67) {   // the held opponent: more and more cut lines flicker across him, in the last frames hard and bright
    const n = Math.min(18, Math.floor((mt - 28) / 2.1) + 1), hot = mt >= 58 ? (mt - 57) / 9 : 0;
    c.save(); c.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const cx = t.x + (nz(i * 7.1) - 0.5) * 30, cy = t.y - t.s.h * (0.15 + 0.7 * nz(i * 5.9)), an = (nz(i * 3.3) - 0.5) * 2.4 + (i % 2 ? 0.45 : -0.45), len = 34 + 26 * nz(i * 2.2);
      const newest = i >= n - 2;
      c.globalAlpha = (newest ? 0.95 : 0.38 + 0.2 * hot) * (mt < 40 ? 0.8 : 1); c.strokeStyle = "#ffffff"; c.lineWidth = newest ? 2.6 + 1.4 * hot : 1.4 + hot;
      c.beginPath(); c.moveTo(cx - Math.cos(an) * len, cy - Math.sin(an) * len); c.lineTo(cx + Math.cos(an) * len, cy + Math.sin(an) * len); c.stroke();
    }
    if (hot > 0) { c.globalAlpha = 0.3 * hot; c.globalCompositeOperation = "lighter"; glowDot(c, t.x, t.y - t.s.h * 0.5, 60, 0.7 * hot, "#ffffff"); }
    c.restore();
  }
}

/* ---- Reaper: Soul Harvest ---- */
// the tug: chains and ghost lines from the scythe to the opponent, links and wisps flowing towards him
function uvReaperFront(c, g, f, tk) {
  const mt = f.mt, o = g.fighters[1 - f.slot];
  if (mt >= 3 && mt <= 26 && o && o.state !== "dead" && o.state !== "gone" && Math.abs(o.x - f.x) <= 540) {
    const a = clamp(Math.min((mt - 3) / 3, (26 - mt) / 3), 0, 1), P = pose(f, tk), tip = scyTipAt(P.hF, scyAng(f, P), P.bladeS, P.w, P.scyK);
    const ax = f.x + f.facing * tip[0], ay = f.y + tip[1], bx = o.x, by = o.y - o.s.h * 0.5, dx = bx - ax, dy = by - ay, taut = clamp((mt - 4) / 10, 0, 1);
    const mx = (ax + bx) / 2, my = (ay + by) / 2, nl = Math.hypot(dx, dy) || 1, nx = -dy / nl, ny = dx / nl;
    const path = (sag, wav) => { const off = sag + wav; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(mx + nx * off, my + ny * off + 22 * (1 - taut), ax, ay); };
    c.save(); c.globalAlpha = a; c.lineCap = "butt";
    for (let j = 0; j < 2; j++) {   // two chains (a dashed line reads as links), one sagging each way
      const sag = (j ? 1 : -1) * 20 * (1 - taut * 0.7);
      path(sag, 0); c.setLineDash([7, 4]); c.strokeStyle = "rgba(14,12,26,0.85)"; c.lineWidth = 5.4; c.stroke();
      c.strokeStyle = "#d3efe0"; c.lineWidth = 3; c.stroke();
    }
    c.lineCap = "round";
    for (let j = 0; j < 4; j++) {   // ghost lines running to him
      path((j - 1.5) * 16, Math.sin(tk * 0.15 + j * 2) * 12); c.setLineDash([16, 14]); c.lineDashOffset = -tk * 3.4 - j * 5; c.strokeStyle = "rgba(190,255,225,0.55)"; c.lineWidth = 2; c.stroke();
    }
    c.setLineDash([]); c.lineDashOffset = 0;
    c.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {   // little souls riding the chains
      const u = (tk * 0.035 + i / 4) % 1, w = 1 - u, qx = w * w * bx + 2 * w * u * (mx + nx * 10) + u * u * ax, qy = w * w * by + 2 * w * u * (my + ny * 10 + 20 * (1 - taut)) + u * u * ay;
      glowDot(c, qx, qy, 11, 0.8, "#bfffe0"); glowDot(c, qx, qy, 4, 1, "#ffffff");
    }
    c.globalCompositeOperation = "source-over";
    c.lineWidth = 2.6; c.strokeStyle = "rgba(190,255,225,0.8)";   // the hook round his middle
    c.beginPath(); c.ellipse(bx, o.y - o.s.h * 0.35, o.s.w * 0.8 + 3 * Math.sin(tk * 0.5), 7, 0, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
  if (mt >= 25 && mt <= 42) {   // the sweep: a big white crescent on each side, both swinging up over him
    const u = clamp((mt - 25) / 6, 0, 1), fade = mt <= 31 ? 1 : 1 - (mt - 31) / 11, cx = f.x, cy = f.y - 46;
    if (fade > 0) {
      c.save();
      for (const sd of [1, -1]) {
        const n = 18, tail = Math.max(0, u - 0.75), i0 = Math.floor(tail * n), i1 = Math.max(i0 + 2, Math.ceil(u * n)), pts = [];
        for (let i = i0; i <= i1; i++) { const s = i / n, an = lerp(0.95, -1.55, s); pts.push([cx + sd * Math.cos(an) * 112, cy + Math.sin(an) * 92]); }
        c.globalAlpha = 0.55 * fade; c.fillStyle = "rgba(190,255,225,0.9)"; brush(c, pts, 44, pts.length - 1);
        c.globalAlpha = 0.95 * fade; c.fillStyle = "rgba(20,15,30,0.5)"; brush(c, pts, 30, pts.length - 1);
        c.globalAlpha = fade; c.fillStyle = "#ffffff"; brush(c, pts, 24, pts.length - 1);
      }
      c.restore();
    }
  }
}

/* ---- Wizard: Meteor Shower ---- */
function uvWizardFront(c, f, tk) {   // a rune circle turning above his head while he calls the stars
  const mt = f.mt;
  if (mt < 1 || mt > 64) return;
  const a = (mt < 8 ? mt / 8 : mt > 46 ? clamp(1 - (mt - 46) / 18, 0, 1) : 1), cx = f.x, cy = f.y - f.s.h - 38;
  c.save(); c.translate(cx, cy); c.globalAlpha = a;
  c.save(); c.scale(1, 0.26); glowDot(c, 0, 0, 74, 0.5, "#bff3ff"); c.restore();
  c.lineWidth = 2.2;
  for (const [r, colr] of [[54, "#bff3ff"], [38, "#ffd27a"]]) { c.strokeStyle = colr; c.beginPath(); c.ellipse(0, 0, r, r * 0.26, 0, 0, Math.PI * 2); c.stroke(); }
  for (let i = 0; i < 8; i++) { const an = (i / 8) * Math.PI * 2 + tk * 0.03; rune(c, Math.cos(an) * 46, Math.sin(an) * 46 * 0.26 - 3, 4.2, i, "#fff6d8", 1.2); }
  c.restore();
}

/* ---- Gunslinger: Dead Eye ---- */
function uvDeadEyeFront(c, g, f, tk) {   // a red reticle on the opponent that tightens on every shot
  const mt = f.mt, o = g.fighters[1 - f.slot];
  if (!o || o.state === "dead" || o.state === "gone" || mt < 4 || mt > 72) return;
  const shots = clamp(Math.floor((mt - 24) / 8) + 1, 0, 6), since = mt >= 24 ? (mt - 24) % 8 : 9, k = clamp((mt - 4) / 14, 0, 1), a = clamp((74 - mt) / 8, 0, 1);
  const r = lerp(62, 26, ease(k)) * (1 - 0.08 * shots) * (1 + (since < 3 ? 0.14 : 0)), x = o.x, y = o.y - o.s.h * 0.55;
  c.save(); c.globalAlpha = a; c.lineCap = "round";
  c.strokeStyle = since < 2 ? "#ffffff" : "#ff3030"; c.lineWidth = 2.6;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 2.2;
  for (let i = 0; i < 4; i++) { const an = (i / 4) * Math.PI * 2 + 0.785 * 0; c.beginPath(); c.moveTo(x + Math.cos(an) * (r - 7), y + Math.sin(an) * (r - 7)); c.lineTo(x + Math.cos(an) * (r + 9), y + Math.sin(an) * (r + 9)); c.stroke(); }
  c.fillStyle = "#ff3030"; c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill();
  c.globalAlpha = a * 0.35; c.lineWidth = 6; c.strokeStyle = "#ff3030"; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  c.restore();
}
function uvEyeVignette(c, g) {   // screen space: a red vignette while the dead eye is open
  let k = 0;
  for (const f of g.fighters) if (uvHeld(f) === "deadeye") k = Math.max(k, clamp(f.mt / 8, 0, 1) * clamp((96 - f.mt) / 12, 0, 1));
  if (k <= 0.01) return;
  const R = Math.hypot(L.gw, L.gh), gr = c.createRadialGradient(L.gw / 2, L.gh / 2, R * 0.16, L.gw / 2, L.gh / 2, R * 0.6);
  gr.addColorStop(0, "rgba(150,10,24,0)"); gr.addColorStop(1, `rgba(150,10,24,${0.5 * k})`);
  c.save(); c.fillStyle = gr; c.fillRect(0, 0, L.gw, L.gh); c.fillStyle = `rgba(120,0,14,${0.07 * k})`; c.fillRect(0, 0, L.gw, L.gh); c.restore();
}

/* ---- over the fighters, world space ---- */
function uvFront(c, g, tk) {
  for (const f of g.fighters) {
    const k = uvHeld(f);
    if (!k) continue;
    if (k === "dive") uvPhoenixFront(c, f, tk);
    else if (k === "hellfire") uvDragonFire(c, f, tk);
    else if (k === "cuts") uvSamuraiFront(c, g, f, tk);
    else if (k === "harvest") uvReaperFront(c, g, f, tk);
    else if (k === "stars") uvWizardFront(c, f, tk);
    else if (k === "deadeye") uvDeadEyeFront(c, g, f, tk);
  }
}

/* ---- once per sim tick: particles and sounds of the ulti being played ---- */
function uvFighterTick(g, f) {
  const k = uvHeld(f), mt = f.mt, d = f.facing, live = mode === "match" && !FIN.on && g === G;
  if (mt === 0) return;   // the super freeze: drawn from the UI clock
  const o = g.fighters[1 - f.slot];
  if (k === "dive") {
    if (mt < 15) UV.at[f.slot] = { x: f.x, y: f.y + UV_RISE * mt };
    if (mt >= 1 && mt < 15) { for (let i = 0; i < 3; i++) ember(f.x + frand(-16, 16), f.y + frand(0, 60), frand(-1.4, 1.4), frand(0.6, 3.2)); if (mt === 1) { addFx({ k: "uv", sub: "ringf", x: f.x, y: UV.at[f.slot].y, r0: 20, r1: 110, col: "#ffb04a", t: 0, life: 16 }); dust(f.x, UV.at[f.slot].y, 8, 60); } }
    if (mt >= 31 && mt < 60 && f.y < 0) for (let i = 0; i < 4; i++) ember(f.x + frand(-22, 22), f.y - 34 - frand(0, 50), frand(-1, 1), -frand(0.2, 2));
  } else if (k === "cloud") {
    if (mt >= 6 && mt <= 24) mote(f.x + d * frand(-18, 6), f.y - frand(72, 112), frand(-0.5, 0.5), -frand(0.3, 1.3), "#9bff6a", 2.3, 22, 0);
  } else if (k === "spear") {
    if (mt >= 8 && mt <= 25) mote(f.x + d * frand(-30, 10), f.y - frand(36, 78), frand(-0.5, 0.5), -frand(0.2, 1), "#ffd23f", 2.2, 22, 0);
  } else if (k === "stars") {
    if (mt >= 4 && mt <= 46 && (mt & 1) === 0) { const [tx, ty] = staffTip(f, tick); mote(tx + frand(-5, 5), ty + frand(-5, 5), frand(-0.6, 0.6), -frand(0.6, 2), (mt & 3) ? "#bff3ff" : "#fff6d8", 2.4, 24, 0); }
  } else if (k === "cuts") {
    if (mt <= 23) UV.dash[f.slot] = { x: f.x };
    if (mt <= 21 && (mt & 1) === 0) addFx({ k: "petal", x: f.x + d * frand(-110, 110), y: f.y - frand(6, 80), vx: 0, vy: frand(-0.4, 0.2), rot: frand(0, 6), vr: frand(-0.25, 0.25), col: mix(f.pal.accent, "#ffb7c9", 0.65), r: frand(2.4, 3.4), t: 0, life: 26, g: 0, damp: 1, tow: f.slot });
    if (mt === 24 && uvCue(f, "dash")) { if (live) Sfx.cutPass(); for (let i = 0; i < 8; i++) addFx({ k: "puff", x: f.x - d * 20, y: f.y - frand(2, 12), vx: -d * frand(1, 4), vy: -frand(0, 1.2), r: frand(4, 8), t: 0, life: 22 }); sfx.push({ k: "flash", t: 0, life: 5 }); }
    if (mt >= 24 && mt <= 35) addFx({ k: "line", x: f.x, y: f.y - frand(10, 56), vx: -d * frand(4, 10), vy: 0, t: 0, life: 9, col: "#ffffff", w: 2 });
    if (mt === 36 && uvCue(f, "stop")) dust(f.x, f.y, 6, 40);
  } else if (k === "hellfire") {
    if (mt === 25 && uvCue(f, "fire") && live) Sfx.hellfire();
    if (mt >= 25 && mt <= 66) {
      cam.shake = Math.max(cam.shake, 2.4);
      const [ox] = uvMouthWorld(f, tick), len = 408 * easeOut2(clamp((mt - 24) / 6, 0, 1));
      for (let i = 0; i < 3; i++) { const u = frand(0.1, 1); ember(f.x + d * (60 + (len - 60) * u), f.y - 50 + frand(-36, 36), d * frand(0, 2.4), -frand(0.4, 2.8)); }
      if (mt % 3 === 0) addFx({ k: "puff", x: f.x + d * frand(70, len), y: f.y - 50 + frand(-34, 20), vx: d * frand(0, 1), vy: -frand(0.4, 1.2), r: frand(7, 12), t: 0, life: 32, col: "#6b5560" });
      void ox;
    }
    if (mt === 61 && uvCue(f, "blast")) {
      const ex = f.x + d * 380;
      addFx({ k: "ring", x: ex, y: f.y - 50, t: 0, life: 16, r0: 10, r1: 120, col: UV_GOLD });
      for (let i = 0; i < 22; i++) ember(ex + frand(-50, 20) * d, f.y - 50 + frand(-44, 44), frand(-6, 6), frand(-6, 2));
      cam.shake = Math.max(cam.shake, 12); sfx.push({ k: "flash", t: 0, life: 8 });
      if (live) Sfx.hellBlast();
    }
  } else if (k === "deadeye") {
    if (mt === 1 && uvCue(f, "eye") && live) Sfx.deadEye();
  } else if (k === "harvest") {
    if (mt === 4 && uvCue(f, "pull") && live) Sfx.reapPull();
    if (mt >= 4 && mt <= 23 && mt % 3 === 0 && o && Math.abs(o.x - f.x) <= 540) addFx({ k: "wisp", x: o.x + frand(-14, 14), y: o.y - frand(10, 60), vx: Math.sign(f.x - o.x) * 1.8, vy: -0.3, ph: frand(0, 6), r: 5, col: "#bfffe0", t: 0, life: 26, damp: 0.99 });
    if (mt === 25 && uvCue(f, "sweep")) {
      for (let i = 0; i < 6; i++) addFx({ k: "ghost", x: f.x + frand(-60, 60), y: f.y - frand(20, 90), vx: frand(-1, 1), vy: -frand(1, 2.6), ph: frand(0, 6), r: frand(5, 8), t: 0, life: frand(36, 52), damp: 0.97 });
      cam.shake = Math.max(cam.shake, 6);
      if (live) Sfx.reapSweep();
    }
  }
}

/* ===================== Gunslinger: the lights are point-blank shots (UI only) =====================
   core.js gives every Gunslinger light shot: true and a thin hitbox that sweeps out from the muzzle over the active frames (jab, side and
   sair level, up and uair straight up, down along the floor, dair straight down, nair to both sides with both pistols). So the pistol
   is aimed along the box path (gunLightPose), flashes on the first active frame (P.shotF / P.shotB, the same flash as Twin Shot, small),
   the hand kicks back, a bright tracer runs from the muzzle to the sweeping box (drawGunLightFx) and a puff of smoke and a shell
   leave with a short "pop" (uvShotTick, once per move). */
function gunLightPose(f, P, m, phase, k, w, leg, tor, set) {
  const a0 = m.startup + 1, age = f.mt - a0, up = phase === 0 ? ease(k) : phase === 2 ? 1 - ease(k) : 1;
  const kk = age >= 0 && age < 5 ? 1 - age / 5 : 0;   // the kick: full on the shot frame, gone five frames later
  const restF = [w * 0.5, -leg - tor * 0.52], restB = [w * 0.2, -leg - tor * 0.42];
  const dirOf = (b) => (b.x2 !== b.x || b.y2 !== b.y ? Math.atan2(b.y2 - b.y, b.x2 - b.x) : 0);
  // where the hand goes so that a pistol held along a has its muzzle at the start of the box (kept in front of, or behind, the body)
  const aim = (b, a, back) => {
    const s = back ? 0.92 : 1, ca = Math.cos(a), sa = Math.sin(a);
    let hx = b.x - (18.5 * ca + 2.7 * sa) * s, hy = b.y - (18.5 * sa - 2.7 * ca) * s;
    hx = back ? Math.min(hx, -w * 0.55) : Math.abs(ca) > 0.5 ? Math.max(hx, w * 0.6) : Math.max(hx, w * 0.45);
    return [hx - ca * 5 * kk, hy - sa * 5 * kk];   // the recoil pushes the hand back along the barrel
  };
  const flip = (a) => a + (Math.cos(a) >= 0 ? -1 : 1) * 0.45 * kk;   // the muzzle lifts on the kick
  P.noSwoosh = true; P.spin = 0;
  const b0 = m.boxes[0], a = dirOf(b0), two = m.boxes.length > 1;
  const hF = lerp2(restF, aim(b0, a, false), up);
  P.holdAng = lerp(-0.3, flip(a), up);
  let hB = null;
  if (two) {   // nair: the back pistol fires the other way
    const b1 = m.boxes[1], a1 = dirOf(b1);
    hB = lerp2(restB, aim(b1, a1, true), up); P.gunB = lerp(Math.PI + 0.35, flip(a1), up);
    if (age >= 0 && age < 3) P.shotB = age;
  }
  P.lean = (Math.sin(a) < -0.7 ? -0.04 : -0.06) * up - 0.05 * kk;
  if (Math.sin(a) > 0.7 && f.grounded) P.crouch = Math.max(P.crouch, 0.18 * up);   // down: the floor shot from a crouch
  if (age >= 0 && age < 3) P.shotF = age;
  set(hF, hB);
}
// the tracer: from the muzzle to the sweeping box, a dark edge, an orange body and a white core, a bright head; it fades in the three frames after the window
function drawGunLightFx(c, f, P, tk) {
  const m = f.move, a0 = m.startup + 1, a1 = m.startup + m.active, mt = f.mt;
  if (mt < a0 || mt > a1 + 3) return;
  const fade = mt <= a1 ? 1 : 1 - (mt - a1) / 4, t = m.active > 1 ? clamp((Math.min(mt, a1) - a0) / (m.active - 1), 0, 1) : 1;
  c.save(); c.lineCap = "round";
  m.boxes.forEach((b, i) => {
    const back = i === 1, hand = back ? P.hB : P.hF, a = back ? P.gunB : P.holdAng;
    if (a == null) return;
    const [mx, my] = gunMuzzle(P, hand, a, back), hx = b.x + (b.x2 - b.x) * t, hy = b.y + (b.y2 - b.y) * t, ux = Math.cos(a), uy = Math.sin(a);
    const len = (hx - mx) * ux + (hy - my) * uy;   // how far past the muzzle the head is
    if (len > 3) {
      const ex = mx + ux * len, ey = my + uy * len;
      c.globalAlpha = 0.55 * fade; c.strokeStyle = "rgba(20,15,30,0.9)"; c.lineWidth = 6.5; c.beginPath(); c.moveTo(mx, my); c.lineTo(ex, ey); c.stroke();
      c.globalAlpha = 0.95 * fade; c.strokeStyle = "#ffb347"; c.lineWidth = 3.6; c.beginPath(); c.moveTo(mx, my); c.lineTo(ex, ey); c.stroke();
      c.strokeStyle = "#ffffff"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(mx, my); c.lineTo(ex, ey); c.stroke();
    }
    c.globalAlpha = fade; glowDot(c, hx, hy, 15, 0.8, "#ffd27a"); star4(c, hx, hy, 5 + 2 * (1 - t), "#ffffff");
  });
  c.restore();
}
// once per shot, on the first active frame: a puff of smoke from each muzzle, a shell from the front pistol and a quiet "pop"
function uvShotTick(g, f) {
  const m = f.move;
  if (f.mt !== m.startup + 1 || !uvCue(f, "shot")) return;
  const P = pose(f, tick), live = mode === "match" && !FIN.on && g === G;
  m.boxes.forEach((b, i) => {
    const back = i === 1, [mx, my] = gunMuzzle(P, back ? P.hB : P.hF, (back ? P.gunB : P.holdAng) || 0, back);
    gunSmoke(f, [[mx, my]], 2);
  });
  gunShell(f, P.hF[0], P.hF[1] - 2);
  if (live) Sfx.pop();
}
