/* ===================== drawing: fighters ===================== */
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const ease = (x) => x * x * (3 - 2 * x);
function rot(p, c, a) { const dx = p[0] - c[0], dy = p[1] - c[1], cs = Math.cos(a), sn = Math.sin(a); return [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs]; }

function pose(f, tk) {
  const L_ = f.spec.look, s = f.s, w = s.w, h = s.h;
  const leg = h * L_.leg, tor = h * L_.torso, hr = h * L_.headR;
  const P = { leg, tor, hr, w, h, crouch: 0, lean: 0, spin: 0, swoosh: null, dim: false, mouth: 0, tailTo: null, flap: 0 };
  let fF = [w * 0.24, 0], fB = [-w * 0.2, 0];
  let hF = [w * 0.5, -leg - tor * 0.52], hB = [w * 0.2, -leg - tor * 0.42];
  const st = f.state;
  let bob = 0;
  if (st === "idle" || st === "getup" || st === "respawn") bob = Math.sin(tk * 0.09 + f.slot * 2) * 1.6;
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
    let tx = w * 0.9, ty = -leg - tor * 0.6;
    if (b) { const t = m.active > 1 ? clamp((f.mt - a0) / (m.active - 1), 0, 1) : 0; tx = b.x + (b.x2 - b.x) * t; ty = b.y + (b.y2 - b.y) * t; }
    const phase = f.mt < a0 ? 0 : f.mt <= a1 ? 1 : 2;
    const k = phase === 0 ? f.mt / Math.max(1, m.startup) : phase === 2 ? (f.mt - a1) / Math.max(1, m.endlag) : 1;
    const wind = [-Math.abs(tx) * 0.3 - w * 0.25, ty * 0.85 + 4];
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
    if (m.kind === "charge" && phase === 0) P.crouch = 0.3 * ease(k);
    if (m.pound) { fF = [w * 0.08, 4]; fB = [-w * 0.12, 2]; hF = [w * 0.42, -leg - tor * 1.15]; hB = [-w * 0.42, -leg - tor * 1.1]; }
    if (phase === 1 && b) P.swoosh = { tx, ty, r: b.r, body: m.limb === "body", sweep: b.x2 !== b.x || b.y2 !== b.y, sx: b.x, sy: b.y, heavy: m.dmg >= 12, fire: !!m.fire };
  }
  if (L_.wings) {
    const fast = st === "attack" && f.move && (f.move.rec || f.mid === "spec");
    P.flap = f.grounded || st === "ledge" ? 0 : Math.sin(tk * (fast ? 0.9 : 0.35)) * (f.vy < 0 || fast ? 0.6 : 0.3);
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
    if (st !== "attack" && st !== "ledge" && st !== "hitstun") {
      if (P.hF[0] < w * 0.75) P.hF = [w * 0.75 + (P.hF[0] - w * 0.5) * 0.4, P.hF[1] + 4];
      if (P.hB[0] > -w * 0.68) P.hB = [-w * 0.68 + (P.hB[0] + w * 0.3) * 0.3, P.hB[1] + 4];
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
  const len = Math.hypot(S.tx - m[0], S.ty - m[1]) + S.r, ang = Math.atan2(S.ty - m[1], S.tx - m[0]);
  const fl = Math.sin(tk * 1.3) * 3;
  c.save(); c.translate(m[0], m[1]); c.rotate(ang);
  const gr = c.createLinearGradient(0, 0, len, 0);
  gr.addColorStop(0, "#fff6c8"); gr.addColorStop(0.3, "#ffc04d"); gr.addColorStop(0.7, "#ff6a2b"); gr.addColorStop(1, "rgba(255,70,30,0)");
  c.fillStyle = gr; c.globalAlpha = 0.95;
  c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(len * 0.5, -(S.r + fl), len, -S.r * 0.35);
  c.lineTo(len, S.r * 0.35); c.quadraticCurveTo(len * 0.5, S.r + fl, 0, 3); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,250,220,0.85)";
  c.beginPath(); c.moveTo(0, -1.5); c.quadraticCurveTo(len * 0.4, -S.r * 0.35, len * 0.65, 0); c.quadraticCurveTo(len * 0.4, S.r * 0.35, 0, 1.5); c.fill();
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
    const k = style === "eager" ? 1.1 : 1, hk = style === "focused" ? 0.8 : 1;
    c.beginPath(); c.ellipse(e[0], e[1], er * k, er * 1.15 * k * hk, 0, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.arc(e[0] + er * 0.15, e[1] + er * 0.1, er * 0.68 * k * hk, 0, Math.PI * 2); c.fillStyle = cos === "dragon" ? "#e6a52a" : "#4a1f14"; c.fill();
    c.beginPath();
    if (cos === "dragon") c.ellipse(e[0] + er * 0.15, e[1] + er * 0.1, er * 0.13, er * 0.55, 0, 0, Math.PI * 2); else c.arc(e[0] + er * 0.15, e[1] + er * 0.1, er * 0.38 * k * hk, 0, Math.PI * 2);
    c.fillStyle = "#120a08"; c.fill();
    c.beginPath(); c.arc(e[0] + er * 0.4, e[1] - er * 0.25, er * 0.22, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill();
    if (style === "focused" || style === "fierce") {
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
    if (style === "evil" || style === "fierce" || style === "focused") { c.moveTo(e[0] + side * er * 0.9, e[1] - er * (style === "focused" ? 1.6 : 1.8)); c.lineTo(e[0] - side * er * 0.7, e[1] - er * (style === "focused" ? 1.15 : 1.2)); }
    else if (style === "stern") { c.moveTo(e[0] - er * 1.1, e[1] - er * 1.45); c.lineTo(e[0] + er * 1.1, e[1] - er * 1.3); }
    else c.arc(e[0], e[1] - er * 0.6, er * 1.1, -2.4, -0.75);
    c.stroke();
  });
  if (style === "stern") return;
  const mx = hx, my = hy + er * 2.3;
  c.strokeStyle = OUT;
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
  const pts = [[-P.w * 0.2, P.hip[1] - 6], [-P.w * 0.75, P.hip[1] + 2], [-P.w * 1.15, -4 + sw * 0.3], [-P.w * 1.45 + sw, -7]];
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
function ravenShape(c, x, y, s, flap) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.lineWidth = 1.4; c.strokeStyle = OUT;
  c.fillStyle = "#16151c"; c.beginPath(); c.moveTo(-6, 2); c.lineTo(-17, 8); c.lineTo(-15, 1); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, 0, 9, 6.5, -0.15, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.arc(7, -5, 4.6, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = "#3a3844"; c.beginPath(); c.moveTo(10.5, -6.5); c.lineTo(16.5, -4.5); c.lineTo(10.5, -3); c.closePath(); c.fill();
  c.fillStyle = "#e33b3b"; c.beginPath(); c.arc(8, -6, 1.2, 0, Math.PI * 2); c.fill();
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
  const fl = 1 + Math.sin(tk * 0.3) * 0.08;
  const glow = c.createRadialGradient(t[0], t[1], 1, t[0], t[1], 16 * fl);
  glow.addColorStop(0, "rgba(255,226,140,0.85)"); glow.addColorStop(1, "rgba(255,200,90,0)");
  c.fillStyle = glow; c.beginPath(); c.arc(t[0], t[1], 16 * fl, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(t[0], t[1]); c.rotate(a + Math.PI / 2);
  c.beginPath(); c.moveTo(0, -11 * fl); c.lineTo(4.5, -2); c.lineTo(2.5, 4); c.lineTo(-2.5, 4); c.lineTo(-4.5, -2); c.closePath();
  c.fillStyle = "#ffd27a"; c.fill(); c.lineWidth = 1.4; c.strokeStyle = "#a8701c"; c.stroke();
  c.fillStyle = "#fff6d8"; c.beginPath(); c.moveTo(0, -7 * fl); c.lineTo(2, -1); c.lineTo(-2, -1); c.closePath(); c.fill();
  c.restore();
  P.staffTip = t;
}
function katana(c, P, f, shR, pal) {
  const a = heldDir(f, P, shR, -0.8), L = P.w * 1.35;
  c.save(); c.translate(P.hF[0], P.hF[1]); c.rotate(a);
  c.lineCap = "round";
  c.strokeStyle = OUT; c.lineWidth = 5.5; c.beginPath(); c.moveTo(-9, 0); c.lineTo(2, 0); c.stroke();
  c.strokeStyle = "#3a2a22"; c.lineWidth = 3; c.stroke();
  c.beginPath(); c.moveTo(4, -1.8); c.quadraticCurveTo(L * 0.55, -3.6, L, -5.5); c.quadraticCurveTo(L * 0.55, 0.6, 4, 1.8); c.closePath();
  c.fillStyle = pal.accent; c.fill(); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 1; c.beginPath(); c.moveTo(7, -1); c.quadraticCurveTo(L * 0.55, -2.5, L - 4, -4.5); c.stroke();
  c.beginPath(); c.ellipse(3, 0, 2.2, 5.2, 0, 0, Math.PI * 2); c.fillStyle = "#c9a227"; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  c.restore();
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
  for (let i = 1; i <= 3; i++) { const t = ((tk * 0.07 + i / 3) % 1) * len; c.beginPath(); c.arc(t, Math.sin(tk * 0.4 + i) * S.r * 0.4, 2, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
function drawPotato(c, f, tk, at) {
  const ox = at ? at[0] : f.x, oy = at ? at[1] : f.y;
  const look = f.spec.look, pal0 = f.pal, cos = look.costume;
  const P = pose(f, tk);
  let alpha = 1;
  if (intangible(f) && f.state !== "respawn" && f.state !== "getup") alpha = (tk >> 2) % 2 ? 0.55 : 0.8;
  if (f.state === "dodge" && f.st >= 3 && f.st <= (f.dodgeKind === "air" ? 20 : 16)) alpha = 0.45;
  const flash = f.flash > 0 && f.flash % 2 === 0;
  const pal = flash ? { body: "#ffffff", trim: "#ffffff", accent: "#ffffff" } : P.dim ? { body: mix(pal0.body, "#6a6a7a", 0.45), trim: pal0.trim, accent: mix(pal0.accent, "#6a6a7a", 0.45) } : pal0;
  const limbF = flash ? "#ffffff" : LIMB, limbB = flash ? "#e8e8f0" : LIMB_BACK;
  c.save();
  c.translate(ox, oy); c.globalAlpha = alpha; c.scale(f.facing, 1);
  if (P.spin) { c.translate(0, -P.h * 0.5); c.rotate(P.spin); c.translate(0, P.h * 0.5); }
  c.lineCap = "round"; c.lineJoin = "round";
  const lw = look.limbW, legLen = Math.max(P.leg * 1.25, 12), armLen = P.tor * 0.85;
  const shR = rot(P.sh, P.hip, P.lean), shB = rot(P.shB, P.hip, P.lean);
  if (cos === "phoenix") {
    const air = !f.grounded && f.state !== "ledge";
    const len = P.w * (air ? 1.35 : 1.0);
    const a1 = rot([-P.w * 0.2, P.cy - P.ry * 0.2], P.hip, P.lean), a2 = rot([P.w * 0.05, P.cy - P.ry * 0.3], P.hip, P.lean);
    flameWing(c, a1[0], a1[1], (air ? -2.7 : -2.4) + P.flap + P.lean, len, pal, true);
    flameWing(c, a2[0], a2[1], (air ? -0.75 : -1.2) - P.flap * 0.7 + P.lean, len * 0.9, pal, false);
  }
  if (cos === "dragon") {
    dragonTail(c, P, pal, tk, f);
    const air = !f.grounded && f.state !== "ledge", len = P.w * (air ? 1.1 : 0.95);
    const a1 = rot([-P.w * 0.3, P.cy + P.ry * 0.1], P.hip, P.lean), a2 = rot([P.w * 0.2, P.cy + P.ry * 0.05], P.hip, P.lean);
    batWing(c, a1[0], a1[1], Math.PI + 0.18 - P.flap + P.lean, len, pal, true, true);
    batWing(c, a2[0], a2[1], -0.25 + P.flap * 0.7 + P.lean, len * 0.9, pal, false, false);
  }
  if (cos === "alchemist") capeShape(c, P, f, tk, mix(pal.accent, "#000000", 0.15), false);
  if (cos === "odin") capeShape(c, P, f, tk, pal.accent, true);
  limbPath(c, P.hipB, P.fB, legLen, "fwd", lw, limbB);
  c.fillStyle = limbB; c.beginPath(); c.ellipse(P.fB[0] + 2, P.fB[1] - 1, 5, 3, 0, 0, Math.PI * 2); c.fill();
  limbPath(c, shB, P.hB, armLen, "down", lw - 0.5, limbB);
  c.fillStyle = limbB; c.beginPath(); c.arc(P.hB[0], P.hB[1], lw * (look.fist ? 1 : 0.85), 0, Math.PI * 2); c.fill();
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
  if (cos === "dragon") {
    c.fillStyle = mix(pal.body, "#fff0c6", 0.45); c.beginPath(); c.ellipse(P.rx * 0.18, P.cy + P.ry * 0.55, P.rx * 0.55, P.ry * 0.32, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = mix(pal.body, "#7a4a22", 0.4); c.lineWidth = 1.2;
    for (const t of [-0.3, 0, 0.3]) { const yy = P.cy + P.ry * (0.55 + t * 0.6), hw2 = P.rx * 0.5 * Math.sqrt(1 - t * t * 1.6); c.beginPath(); c.moveTo(P.rx * 0.18 - hw2, yy); c.lineTo(P.rx * 0.18 + hw2, yy); c.stroke(); }
  }
  potatoFace(c, f, P, look);
  if (cos === "odin") odinBeard(c, P, pal);
  if (cos === "alchemist") {
    alchemistHood(c, P, pal);
    const [gx, gy] = P.head, er = P.w * 0.1;
    for (const dx of [-1.25, 1.2]) { c.fillStyle = "#b8863b"; c.beginPath(); c.arc(gx + dx * er, gy - er * 3.1, er * 0.75, 0, Math.PI * 2); c.fill(); c.fillStyle = "#8fe8d2"; c.beginPath(); c.arc(gx + dx * er, gy - er * 3.1, er * 0.5, 0, Math.PI * 2); c.fill(); }
  }
  if (cos === "wizard") wizardHat(c, P, pal, tk);
  if (cos === "phoenix") for (const a of [-2.2, -1.75, -1.3]) flameWing(c, -P.w * 0.12, P.top + P.ry * 0.2, a, P.w * 0.42, pal, false);
  if (cos === "dragon") {
    c.fillStyle = "#efe3c8"; c.strokeStyle = OUT; c.lineWidth = 1.2;
    for (const x0 of [-P.w * 0.2, P.w * 0.12]) { c.beginPath(); c.moveTo(x0 - 3.5, P.top + 5); c.quadraticCurveTo(x0 - 3, P.top - 8, x0 - 9, P.top - 15); c.quadraticCurveTo(x0 + 1, P.top - 6, x0 + 3.5, P.top + 4); c.closePath(); c.fill(); c.stroke(); }
  }
  if (cos === "samurai") { c.fillStyle = "#1c1714"; c.beginPath(); c.ellipse(-P.w * 0.04, P.top - 2, 5.5, 4.5, 0, 0, Math.PI * 2); c.fill(); sprout(c, -P.w * 0.04, P.top - 5, 0.85); }
  if (cos === "phoenix" || cos === "dragon") sprout(c, -P.w * 0.04, P.top + 1, 1);
  if (cos === "odin") sprout(c, P.w * 0.06, P.top - 3, 0.9);
  c.restore();
  if (cos === "odin" && !f._ravenOut) {
    const p = rot([-P.w * 0.38, P.top + P.ry * 0.62], P.hip, P.lean);
    ravenShape(c, p[0], p[1], 0.85, Math.sin(tk * 0.08) > 0.95 ? 0.4 : 0);
  }
  limbPath(c, shR, P.hF, armLen, "down", lw, limbF);
  c.fillStyle = limbF; c.beginPath(); c.arc(P.hF[0], P.hF[1], lw * (look.fist ? 1.15 : 0.95), 0, Math.PI * 2); c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  if (cos === "wizard") wizardStaff(c, P, f, shR, tk);
  if (cos === "samurai") katana(c, P, f, shR, pal);
  if (cos === "alchemist" && f.specCd <= 0 && !flash) greenOrb(c, P.hF[0] + 2, P.hF[1] - 4, P.w * 0.15, tk);
  if (f.armorFlash > 0 || (BL.armored(f) && tk % 6 < 3)) {
    c.strokeStyle = "rgba(255,240,200,0.8)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -P.h * 0.5, P.w * 0.9, P.h * 0.62, 0, 0, Math.PI * 2); c.stroke();
  }
  if (P.swoosh) {
    const S = P.swoosh, m = f.move;
    c.globalAlpha = alpha * (S.heavy ? 0.75 : 0.55);
    c.strokeStyle = pal0.accent; c.lineCap = "round";
    if (S.fire) { c.globalAlpha = alpha; drawFlame(c, P, S, tk); }
    else if (m && m.zap) { c.globalAlpha = alpha; drawZap(c, [P.hF[0], P.hF[1] - 4], S, tk, skinLvl(f) >= 3 ? pal0.accent : null); }
    else if (m && m.magic) { c.globalAlpha = alpha * 0.95; drawMagic(c, P.staffTip || P.hF, S, tk); }
    else drawSwoosh(c, f, P, S);
  }
  c.restore();
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
  if (ink) {
    const ga = c.globalAlpha;
    c.globalAlpha = ga * 0.8; c.strokeStyle = "rgba(20,15,30,0.85)"; c.lineWidth = lw; path(); c.stroke();
    c.globalAlpha = ga; c.strokeStyle = f.pal.accent; c.lineWidth = lw * 0.45; path(); c.stroke();
    c.strokeStyle = "rgba(20,15,30,0.5)"; c.lineWidth = 1.2; c.setLineDash([2, 5]); path(); c.stroke(); c.setLineDash([]);
    return;
  }
  c.lineWidth = lw; path(); c.stroke();
}

function drawFighter(c, f, tk, at) {
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

