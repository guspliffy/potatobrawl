/* ---- Hashbrown Keep (Jonny: "one in a castle style at day light"; Fable's design: maps-ranks/fable-design.md, Map 2) ----
   A castle on a summer day. Back to front: a blue sky with a small sun and cumulus clouds, green hills with a trebuchet on the far left
   one (it lobs a potato over the keep every 8 s), a tree line, the keep (a roofed central tower, a curtain wall and two flanking
   towers whose tops were blasted off), the moat with lily pads and a duck. The stage is the wall walk (ashlar, arches underneath,
   banners); the two side platforms are the blasted tower tops, hovering on the court wizard's spell. Daylight that still reads: the
   sky top stays a mid blue (white sparks and the HUD read on it) and the band the fighters stand in keeps mid, saturated colours.
   UI only: nothing here touches the simulation. Gradients are cached by size and horizon, the clouds and the sun are sprites. */
MAP_ART.castle = (() => {
  const SKY = [[0, "#4f8ed6"], [0.7, "#8fc2ea"], [1, "#b8dcf2"]], CLOUD = "#eef4fa", CLOUD_SH = "#c3d4e2", HILL_FAR = "#6f9d64", HILL = "#4e7f4a", TREE = "#3f6b3c";
  const KEEP_HI = "#c3aa80", KEEP_SH = "#9c845f";   // the keep, a shade under the stage's stone so the fighters stand out on it
  const STONE_HI = "#cdb68b", STONE = "#a8906a", STONE_SH = "#7d6a4c", FLAG_TOP = "#ebdcb4", ROOF = "#b4533c", ROOF_SH = "#8e3f2d";
  const BANNER = "#c23f3a", GOLD = "#f0c35a", MOAT = "#4f8aa6", MOAT_DEEP = "#28506a", SPLASH = "#d8eef5";
  const C = { g: null, skyK: "", sky: null, moat: null, body: null, cloud: null, sun: null, sunU: 0, splash: [], flap: 0, duckOn: false, bird: 300, gust: 90, gustSrc: null };
  const TAU = Math.PI * 2;

  // ---- sprites (made once) ----
  function cloudSprite() {
    if (C.cloud) return C.cloud;
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 112;
    const x = cv.getContext("2d");
    const puffs = [[70, 72, 30], [108, 52, 38], [150, 46, 34], [186, 66, 28], [126, 74, 30]];
    x.fillStyle = CLOUD_SH;   // the shaded base, a little lower
    for (const [px, py, r] of puffs) { x.beginPath(); x.arc(px, py + 8, r, 0, TAU); x.fill(); }
    x.beginPath(); x.roundRect(42, 70, 172, 30, 15); x.fill();
    x.fillStyle = CLOUD;
    for (const [px, py, r] of puffs) { x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); }
    C.cloud = cv;
    return cv;
  }
  function sunSprite(r) {
    if (C.sun && Math.abs(C.sunU - r) < 0.5) return C.sun;
    const S = Math.ceil(r * 5 * 2) + 4, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const x = cv.getContext("2d"), m = S / 2, k = 2;   // drawn at 2x
    const g = x.createRadialGradient(m, m, r * k * 0.8, m, m, r * k * 2.5);
    g.addColorStop(0, "rgba(255,240,190,0.3)"); g.addColorStop(1, "rgba(255,240,190,0)");
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.fillStyle = "#fff0bc"; x.beginPath(); x.arc(m, m, r * k, 0, TAU); x.fill();   // pale gold, not white: white is for the sparks
    C.sun = cv; C.sunU = r;
    return cv;
  }

  // ---- background (screen space) ----
  // the HUD cards sit in the top corners over a see-through panel: a cloud fades out before it drifts in behind one
  function hudFade(x, y, w, h, gw, up) {
    const cw = up ? gw * 0.35 : clamp(gw * 0.21, 140, 200), ch = up ? 132 : 100;
    if (y - h * 0.4 > ch) return 1;
    return clamp((Math.min(x - w * 0.5 - cw, gw - cw - (x + w * 0.5)) + 6) / 40, 0, 1);
  }
  function bg(c, tk) {
    const gw = L.gw, gh = L.gh, u = Math.min(gw, gh), s = u / 390, up = L.portrait;
    const hz = gh * 0.7 - (cam.y + 110) * cam.z * 0.16, P = (k) => -cam.x * cam.z * k;
    const bank = gh * 0.012, lift = up ? u * 0.12 : 0;   // upright, the stage sits ~40 px above the horizon: the far scenery stands taller
    if (C.gustSrc && (paused || mode !== "match" || FIN.on)) gustStop();   // the breeze never outlives the match
    // sky
    const key = gw + "x" + gh + ":" + Math.round(hz);
    if (C.skyK !== key) {
      C.skyK = key;
      C.sky = c.createLinearGradient(0, 0, 0, hz); for (const [k, v] of SKY) C.sky.addColorStop(k, v);
      C.moat = c.createLinearGradient(0, hz + bank, 0, gh); C.moat.addColorStop(0, MOAT); C.moat.addColorStop(1, MOAT_DEEP);
    }
    c.fillStyle = C.sky; c.fillRect(0, 0, gw, Math.max(0, hz) + 1);
    // the sun: small and pale, high up between the HUD cards
    { const r = u * 0.05, sp = sunSprite(r), d = sp.width / 2; c.drawImage(sp, gw * (up ? 0.49 : 0.27) + P(0.01) - d / 2, hz * (up ? 0.2 : 0.17) - d / 2, d, d); }
    // clouds, above the fight
    const cs = cloudSprite();
    for (const [x0, yk, wk] of up ? [[0.1, 0.4, 0.26], [0.5, 0.47, 0.2], [0.8, 0.36, 0.24]] : [[0.1, 0.12, 0.26], [0.44, 0.2, 0.22], [0.68, 0.36, 0.16], [0.9, 0.46, 0.2]]) {
      const w = u * wk, h = w * (112 / 256), span = gw + w * 2;
      const x = ((((x0 * span + tk * 0.06 * s + P(0.03)) % span) + span) % span) - w, y = hz * yk, a = hudFade(x + w / 2, y, w, h, gw, up);
      if (a <= 0) continue;
      c.globalAlpha = a; c.drawImage(cs, x, y - h * 0.5, w, h);
    }
    c.globalAlpha = 1;
    // far hills, the trebuchet on the left one
    c.fillStyle = HILL_FAR;
    const hills = up ? [[0.18, 0.8, 0.07], [0.86, 0.75, 0.05]] : [[0.1, 0.5, 0.11], [0.5, 0.55, 0.08], [0.9, 0.5, 0.12]];
    for (const [hx, hw, hh] of hills) {
      const x = hx * gw + P(0.06), w = hw * gw, h = hh * gh + lift;
      c.beginPath(); c.moveTo(x - w * 0.7, hz + bank);
      c.bezierCurveTo(x - w * 0.35, hz - h * 0.2, x - w * 0.25, hz - h, x, hz - h);
      c.bezierCurveTo(x + w * 0.25, hz - h, x + w * 0.35, hz - h * 0.2, x + w * 0.7, hz + bank); c.fill();
    }
    const h0 = hills[0], tbx = h0[0] * gw + P(0.06), tby = hz - h0[2] * gh - lift + 1;
    const kx = gw * 0.5 + P(0.3), kw = u * 0.2, kH = Math.min(u * 0.42, hz * 0.55);
    const tOff = up ? gw * 0.3 : u * 0.24, wallH = u * 0.11 + lift;
    trebuchet(c, tbx, tby, s, tk, kx - (tOff + kw * 0.5) * 0.52, hz - wallH * 0.45, hz * 0.35);
    // near hills and the tree line (the far bank of the moat)
    { const bh = gh * 0.04 + lift * 0.8, ox = P(0.1), per = 260 * s, top = (wx) => hz - bh * (0.75 + 0.25 * Math.sin(wx / per * TAU));
      c.fillStyle = HILL; c.beginPath(); c.moveTo(0, hz + bank);
      for (let x = 0; x <= gw + 20; x += 20) c.lineTo(x, top(x - ox));
      c.lineTo(gw, hz + bank); c.closePath(); c.fill();
      c.fillStyle = TREE; const span = gw + 60;
      for (let i = 0; i < 12; i++) {
        const r = u * (0.012 + 0.008 * nz(i * 3.7 + 1)), x = ((((i / 12) * span + nz(i * 5.1) * 30 + ox) % span) + span) % span - 30, y = top(x - ox);
        c.beginPath(); c.arc(x, y - r * 0.6, r, 0, TAU); c.arc(x + r * 0.8, y - r * 0.2, r * 0.75, 0, TAU); c.fill();
      }
    }
    keep(c, tk, kx, hz + bank, u, s, kw, kH + bank, tOff, wallH + bank, u * 0.26 + bank + lift * 0.4);
    // the moat
    c.fillStyle = C.moat; c.fillRect(0, hz + bank, gw, gh - hz - bank);
    const wt = hz + bank, wh = gh - wt;
    c.strokeStyle = "rgba(220,240,250,0.25)"; c.lineWidth = 1.5;
    for (const [f, k, sp] of up ? [[0.08, 0.12, 0.15], [0.4, 0.2, 0.25], [0.72, 0.28, 0.32]] : [[0.1, 0.12, 0.15], [0.62, 0.2, 0.25]]) {
      const y = wt + wh * f, bw = gw / 10, off = (((tk * sp * s - P(k)) % bw) + bw) % bw, a = 2 + f * 2;
      c.beginPath(); c.moveTo(-bw - off, y);
      for (let x = -bw - off; x < gw + bw; x += bw) c.quadraticCurveTo(x + bw * 0.5, y - a, x + bw, y);
      c.stroke();
    }
    // lily pads
    const pads = up ? [[0.1, 0.3], [0.78, 0.62], [0.32, 0.88]] : [[0.05, 0.22], [0.24, 0.8], [0.8, 0.7], [0.95, 0.3]];
    pads.forEach(([x0, yf], i) => {
      const span = gw + 60, x = ((((x0 * span + P(0.5)) % span) + span) % span) - 30, y = wt + wh * yf + Math.sin(tk * 0.05 + i * 2) * 1;
      const r = u * 0.02 * (0.85 + 0.3 * yf);
      c.save(); c.translate(x, y); c.scale(1, 0.42);
      c.fillStyle = "#5e9a4e"; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, -1.2 + i, -1.2 + i + TAU - 0.55); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,255,255,0.18)"; c.beginPath(); c.arc(-r * 0.25, -r * 0.3, r * 0.45, 0, TAU); c.fill();
      c.restore();
      if (i === 1) { c.fillStyle = "#f6a3c0"; c.beginPath(); c.arc(x + r * 0.2, y - r * 0.25, r * 0.28, 0, TAU); c.fill(); }   // a water lily
    });
    // the duck
    { const span = gw + 80, x = ((((0.3 * span + tk * 0.1 * s + P(0.6)) % span) + span) % span) - 40, y = wt + wh * (up ? 0.55 : 0.6);
      C.duckOn = x > -10 && x < gw + 10;
      duck(c, x, y, s, tk, C.flap > 0 && C.flap <= 10); }
  }
  function keep(c, tk, kx, hz, u, s, kw, kH, tOff, wallH, th) {
    // curtain wall between the towers, crenellated
    const ww = tOff * 2, wl = kx - tOff, wTop = hz - wallH, mw = u * 0.022;
    c.fillStyle = KEEP_SH; c.fillRect(wl, wTop, ww, wallH + 1);
    for (let x = wl + mw * 0.5; x < wl + ww - mw; x += mw * 2) c.fillRect(x, wTop - mw * 0.8, mw, mw * 0.8 + 1);
    c.fillStyle = "rgba(110,92,64,0.55)"; c.fillRect(wl, wTop + wallH * 0.35, ww, 2);
    // the flanking towers, tops blasted off (jagged), lit from the left
    const tw = u * 0.09;
    for (const sd of [-1, 1]) {
      const cx = kx + sd * tOff, l = cx - tw / 2, top = hz - th;
      const jag = sd < 0 ? [0.1, -0.02, 0.07, 0.0, 0.12, 0.03, 0.09, 0.02] : [0.04, 0.11, 0.02, 0.09, -0.01, 0.06, 0.1, 0.08];
      c.beginPath(); c.moveTo(l, hz + 1); c.lineTo(l, top + jag[0] * th);
      for (let i = 1; i < jag.length; i++) c.lineTo(l + (tw * i) / (jag.length - 1), top + jag[i] * th);
      c.lineTo(l + tw, hz + 1); c.closePath();
      c.fillStyle = KEEP_HI; c.fill();
      c.save(); c.clip(); c.fillStyle = KEEP_SH; c.fillRect(cx, top - 10, tw, th + 12);
      c.fillStyle = "rgba(110,92,64,0.5)"; c.fillRect(l, top + th * 0.42, tw, 2); c.fillRect(l, top + th * 0.72, tw, 2);
      c.restore();
      c.fillStyle = "#3a3340"; c.fillRect(cx - 1.5 * s, top + th * 0.5, 3 * s, 9 * s);   // an arrow slit
    }
    // the keep: a roofed central tower
    const l = kx - kw / 2, top = hz - kH;
    c.fillStyle = KEEP_HI; c.fillRect(l, top, kw / 2, kH + 1);
    c.fillStyle = KEEP_SH; c.fillRect(kx, top, kw / 2, kH + 1);
    c.fillStyle = "rgba(110,92,64,0.5)"; c.fillRect(l, top + kH * 0.55, kw, 2);
    c.fillStyle = "#3a3340";
    for (const dx of [-0.24, 0.24]) c.fillRect(kx + dx * kw - 1.5 * s, hz - kH * 0.36, 3 * s, 11 * s);   // arrow slits, lower half only
    // conical roof (behind the parapet), the pennant on top
    const rb = top - 6 * s, rw = kw * 0.5, rh = u * 0.15;
    c.fillStyle = ROOF; c.beginPath(); c.moveTo(kx - rw, rb); c.lineTo(kx, rb - rh); c.lineTo(kx, rb); c.closePath(); c.fill();
    c.fillStyle = ROOF_SH; c.beginPath(); c.moveTo(kx + rw, rb); c.lineTo(kx, rb - rh); c.lineTo(kx, rb); c.closePath(); c.fill();
    const pt = rb - rh - 12 * s, fl = Math.sin(tk * 0.12);
    c.strokeStyle = "#4a4653"; c.lineWidth = 1.5 * s; c.beginPath(); c.moveTo(kx, rb - rh + 1); c.lineTo(kx, pt); c.stroke();
    c.fillStyle = BANNER; c.beginPath(); c.moveTo(kx, pt);
    c.quadraticCurveTo(kx + 7 * s, pt + 1 + fl * 2 * s, kx + 14 * s, pt + 3 * s + fl * 1.2 * s);
    c.quadraticCurveTo(kx + 7 * s, pt + 5 * s - fl * 1.5 * s, kx, pt + 6 * s); c.closePath(); c.fill();
    // the parapet: a corbelled band and five merlons
    const bw = kw * 1.12, bl = kx - bw / 2, bh = 7 * s, m = bw / 9;
    c.fillStyle = KEEP_HI; c.fillRect(bl, top - bh * 0.4, bw / 2, bh);
    c.fillStyle = KEEP_SH; c.fillRect(kx, top - bh * 0.4, bw / 2, bh);
    for (let i = 0; i < 5; i++) { const x = bl + m * i * 2; c.fillStyle = x + m / 2 < kx ? KEEP_HI : KEEP_SH; c.fillRect(x, top - bh * 0.4 - 8 * s, m, 8 * s + 1); }
  }
  // the trebuchet (a dark silhouette on the hill top) and its potato: every 8 s the arm swings over in 20 ticks, the potato flies 150 ticks
  // over the keep and lands behind the curtain wall in a puff of dust
  function trebuchet(c, x, y, s, tk, lx, ly, ay) {
    const ph = tk % 480;
    let a;   // the long arm's angle (y points down): 150 deg rests down-left, 315 deg is the release up-right
    if (ph < 20) a = 150 + 165 * ease(ph / 20);
    else if (ph < 70) a = 315;
    else if (ph < 370) a = 315 - 165 * ease((ph - 70) / 300);
    else a = 150;
    a *= Math.PI / 180;
    const px = x, py = y - 15 * s, ca = Math.cos(a), sa = Math.sin(a), La = 19 * s, Ls = 6 * s;
    const tx = px + ca * La, ty = py + sa * La, cx = px - ca * Ls, cy = py - sa * Ls;
    c.fillStyle = TREE; c.strokeStyle = TREE; c.lineCap = "round";
    c.fillRect(x - 11 * s, y - 2.5 * s, 22 * s, 3 * s);                                                       // base
    c.lineWidth = 2.4 * s; c.beginPath(); c.moveTo(x - 8 * s, y - 1); c.lineTo(px, py); c.lineTo(x + 8 * s, y - 1); c.stroke();   // A-frame
    c.lineWidth = 2 * s; c.beginPath(); c.moveTo(cx, cy); c.lineTo(tx, ty); c.stroke();                       // arm
    c.fillRect(cx - 3.5 * s, cy, 7 * s, 6 * s);                                                                // counterweight
    c.lineWidth = 1; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + (ph < 20 ? -ca : 0) * 3 * s, ty + 5 * s); c.stroke();   // sling
    c.lineCap = "butt";
    const spud = (qx, qy, rot) => {
      c.save(); c.translate(qx, qy); c.rotate(rot);
      c.fillStyle = "#a86a3b"; c.beginPath(); c.ellipse(0, 0, 4.4 * s, 3.3 * s, 0, 0, TAU); c.fill();
      c.fillStyle = "#6e4223"; c.fillRect(-1.8 * s, -1.2 * s, 1.2 * s, 1.2 * s); c.fillRect(1.2 * s, 0.3 * s, 1.2 * s, 1.2 * s);
      c.restore();
    };
    if (ph >= 400 || ph < 20) spud(tx, ty + 5 * s, 0);   // loaded in the sling
    else if (ph >= 20 && ph < 170) {
      const q = (ph - 20) / 150, hgt = (ty + ly) * 0.5 - ay;
      spud(tx + (lx - tx) * q, ty + (ly - ty) * q - hgt * 4 * q * (1 - q), q * 14);
    } else if (ph >= 170 && ph < 190) {   // the landing: a puff of dust over the wall
      const k = (ph - 170) / 20;
      c.fillStyle = `rgba(214,200,170,${0.7 * (1 - k)})`;
      for (const [dx, r] of [[-5, 4], [0, 5.5], [5, 4]]) { c.beginPath(); c.arc(lx + dx * s * (1 + k), ly - (4 + k * 8) * s, r * s * (0.6 + k * 0.7), 0, TAU); c.fill(); }
    }
  }
  function duck(c, x, y, s, tk, flap) {
    const bob = Math.sin(tk * 0.08) * 0.8 * s;
    c.save(); c.translate(x, y + bob);
    c.strokeStyle = "rgba(220,240,250,0.35)"; c.lineWidth = 1; c.beginPath(); c.moveTo(-9 * s, 1.5 * s); c.lineTo(-16 * s, 3 * s); c.moveTo(-9 * s, 2.5 * s); c.lineTo(-14 * s, 5 * s); c.stroke();   // the wake
    c.fillStyle = "#f3efe0"; c.beginPath(); c.ellipse(0, 0, 8 * s, 4.2 * s, 0, 0, TAU); c.fill();
    c.beginPath(); c.arc(6 * s, -5.5 * s, 3.4 * s, 0, TAU); c.fill();
    c.fillStyle = "#f29a2e"; c.beginPath(); c.moveTo(9 * s, -6 * s); c.lineTo(13 * s, -4.8 * s); c.lineTo(9 * s, -3.8 * s); c.closePath(); c.fill();
    c.fillStyle = "#22202c"; c.fillRect(6.6 * s, -6.8 * s, 1.3 * s, 1.3 * s);
    c.fillStyle = "#d9d2bd";
    if (flap) { c.beginPath(); c.moveTo(-2 * s, -2 * s); c.lineTo(-7 * s, -11 * s); c.lineTo(2 * s, -3 * s); c.closePath(); c.fill(); }
    else { c.beginPath(); c.ellipse(-1.5 * s, -0.8 * s, 4.5 * s, 2 * s, -0.15, 0, TAU); c.fill(); }
    c.restore();
  }

  // ---- the stage (world space): the wall walk and the two blasted tower tops ----
  function stage(c, tk) {
    const S = STAGE.main, x1 = S.x1, x2 = S.x2, W = x2 - x1, B = 64;
    if (!C.body) {
      C.body = c.createLinearGradient(0, 0, 0, B); C.body.addColorStop(0, STONE); C.body.addColorStop(1, STONE_SH);
    }
    // the body: ashlar, with ten shallow arches along the bottom between eleven piers
    const n = 10, pw = 9, step = (W - 20) / n, crown = 14;
    const body = () => {
      c.beginPath(); c.moveTo(x1, S.top); c.lineTo(x2, S.top); c.lineTo(x2, B);
      for (let j = n; j >= 1; j--) {
        const pr = x1 + 10 + j * step, pl = x1 + 10 + (j - 1) * step;
        c.lineTo(pr - pw, B); c.quadraticCurveTo((pr + pl) / 2, B - crown * 2, pl + pw, B);
      }
      c.lineTo(x1, B); c.closePath();
    };
    body(); c.fillStyle = C.body; c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 14; i++) {   // a few lighter / darker blocks
      const row = 1 + (i % 3), col = Math.floor(nz(i * 7.3 + 2) * (W / 44)), off = row % 2 ? 22 : 0;
      c.fillStyle = i % 2 ? "rgba(255,240,210,0.12)" : "rgba(60,44,30,0.12)"; c.fillRect(x1 + col * 44 + off, row * 16, 44, 16);
    }
    c.strokeStyle = "rgba(17,16,28,0.35)"; c.lineWidth = 2; c.beginPath();
    for (const y of [16, 32, 48]) { c.moveTo(x1, y); c.lineTo(x2, y); }
    for (let r = 0; r < 4; r++) for (let x = x1 + (r % 2 ? 22 : 0); x < x2; x += 44) { c.moveTo(x, r * 16); c.lineTo(x, r * 16 + 16); }
    c.stroke();
    c.strokeStyle = "rgba(60,44,28,0.3)"; c.lineWidth = 6; c.beginPath();   // the arch rings
    for (let j = 1; j <= n; j++) { const pr = x1 + 10 + j * step, pl = x1 + 10 + (j - 1) * step; c.moveTo(pl + pw - 1, B); c.quadraticCurveTo((pr + pl) / 2, B - crown * 2 - 6, pr - pw + 1, B); }
    c.stroke();
    c.restore();
    body(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    // banners hanging from the walk: red, a gold stripe and a gold potato
    for (const bx of [-340, -120, 120, 340]) banner(c, bx, tk);
    // the lip: flagstones
    c.beginPath(); c.roundRect(x1 - 4, S.top - 3, W + 8, 12, 5);
    c.fillStyle = STONE_HI; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = FLAG_TOP; c.fillRect(x1, S.top - 2, W, 3);
    c.strokeStyle = "rgba(17,16,28,0.3)"; c.lineWidth = 1.5; c.beginPath();
    for (let x = x1 + 50; x < x2 - 10; x += 50) { c.moveTo(x, S.top + 1); c.lineTo(x, S.top + 8); }
    c.stroke();
    c.fillStyle = "#f5ecd2"; c.fillRect(x1 - 4, S.top - 3, 8, 3); c.fillRect(x2 - 4, S.top - 3, 8, 3);
    // the tower tops
    for (const p of STAGE.plats) towerTop(c, p, tk);
    // the moat splash of a bottom KO (screen space, over the stage, under the fighters)
    if (C.splash.length) drawSplash(c);
  }
  function banner(c, bx, tk) {
    const sw = Math.sin(tk * 0.035 + bx * 0.05) * 1.4, y0 = 6, y1 = 40, w = 20;
    c.beginPath(); c.moveTo(bx - w / 2, y0); c.lineTo(bx + w / 2, y0); c.lineTo(bx + w / 2 + sw * 0.4, y1 - 7); c.lineTo(bx + sw, y1); c.lineTo(bx - w / 2 + sw * 0.4, y1 - 7); c.closePath();
    c.fillStyle = BANNER; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = GOLD; c.fillRect(bx - w / 2 + 1, y0 + 3, w - 2, 3);
    c.beginPath(); c.ellipse(bx + sw * 0.4, 21, 5, 3.6, -0.3, 0, TAU); c.fill();   // the house's arms: a golden potato
    c.fillStyle = BANNER; c.fillRect(bx - 2.2 + sw * 0.4, 19.5, 1.4, 1.4); c.fillRect(bx + 1 + sw * 0.4, 21.2, 1.4, 1.4);
    c.fillStyle = "#4a4653"; c.fillRect(bx - w / 2 - 2, y0 - 1.5, w + 4, 3);   // the rod
  }
  function towerTop(c, p, tk) {
    const cx = (p.x1 + p.x2) / 2, w = p.x2 - p.x1, out = cx < 0 ? -1 : 1, gy = p.y + 18 + Math.sin(tk * 0.03 + p.x1) * 2;
    // the spell holding it up: a pale gold glow and a dashed gold ring turning under it, three sparks riding the ring
    const rx = w * 0.45, ry = 7, ra = tk * 0.01;
    c.fillStyle = "rgba(255,226,140,0.26)"; c.beginPath(); c.ellipse(cx, gy, w * 0.4, 5, 0, 0, TAU); c.fill();
    c.save(); c.setLineDash([7, 6]); c.lineDashOffset = -ra * rx; c.strokeStyle = "rgba(226,166,48,0.6)"; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(cx, gy + 2, rx, ry, 0, 0, TAU); c.stroke(); c.restore();
    for (let i = 0; i < 3; i++) {
      const a = ra * 3 + (i * TAU) / 3, tw = 0.5 + 0.5 * Math.sin(tk * 0.09 + i * 2.1);
      c.globalAlpha = 0.35 + 0.65 * tw; star4(c, cx + Math.cos(a) * rx, gy + 2 + Math.sin(a) * ry, 2.2 + 1.6 * tw, "#ffe08a");
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 2; i++) {   // two loose pebbles going round below it
      const a = tk * (TAU / 120) + i * Math.PI;
      c.fillStyle = i ? STONE : STONE_SH; c.beginPath(); c.arc(cx + Math.cos(a) * w * 0.28, p.y + 21 + Math.sin(a) * 3, 2, 0, TAU); c.fill();
    }
    // a broken merlon at the outer end, behind the feet
    const mx = out < 0 ? p.x1 + 8 : p.x2 - 14;
    c.beginPath(); c.moveTo(mx, p.y); c.lineTo(mx, p.y - 6); c.lineTo(mx + 2.5, p.y - 4.5); c.lineTo(mx + 4, p.y - 7); c.lineTo(mx + 6, p.y - 5); c.lineTo(mx + 6, p.y); c.closePath();
    c.fillStyle = STONE; c.fill(); c.lineWidth = 1.5; c.strokeStyle = OUT; c.stroke();
    // three small stone chunks hanging under it
    c.fillStyle = STONE; c.lineWidth = 1.5;
    for (const [dx, d, hw] of [[-0.3, 5, 8], [0.04, 6, 6], [0.32, 4, 7]]) {
      const x = cx + dx * w;
      c.beginPath(); c.moveTo(x - hw, p.y + 8); c.lineTo(x + hw, p.y + 8); c.lineTo(x + hw * 0.5, p.y + 9 + d); c.lineTo(x - hw * 0.2, p.y + 10 + d * 0.8); c.lineTo(x - hw * 0.7, p.y + 9 + d * 0.5); c.closePath();
      c.fill(); c.strokeStyle = OUT; c.stroke();
    }
    // the slab: light on top, its underside in shade
    c.beginPath(); c.roundRect(p.x1, p.y - 1, w, 11, 5);
    c.fillStyle = STONE_HI; c.fill();
    c.save(); c.clip(); c.fillStyle = STONE; c.fillRect(p.x1, p.y + 6, w, 5); c.restore();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = FLAG_TOP; c.fillRect(p.x1 + 4, p.y, w - 8, 2.5);
    c.strokeStyle = "rgba(17,16,28,0.3)"; c.lineWidth = 1.5; c.beginPath();
    for (const k of [0.33, 0.66]) { c.moveTo(p.x1 + w * k, p.y + 3); c.lineTo(p.x1 + w * k, p.y + 9); }
    c.stroke();
  }

  // ---- the moat splash (bottom KO) ----
  // a beat after the fighter drops out of the bottom of the screen (so it is not lost under the root of the KO beam): a column of
  // water, two rings and ten drops fanning out wider than the beam; 40 ticks in all
  function drawSplash(c) {
    const u = Math.min(L.gw, L.gh), s = u / 390, y = L.gh - u * 0.08;
    c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.fillStyle = SPLASH; c.strokeStyle = SPLASH;
    for (const q of C.splash) {
      const x = clamp(toScreen(q.x, 0)[0], 24, L.gw - 24), t = q.t - 6;
      if (t < 0) continue;
      for (const [d, r0, r1] of [[0, 14, 100], [7, 8, 56]]) {   // the rings on the water
        const k = (t - d) / 26;
        if (k < 0 || k >= 1) continue;
        const r = (r0 + (r1 - r0) * ease(k)) * s;
        c.globalAlpha = 0.95 * (1 - k); c.lineWidth = (3.5 * (1 - k) + 1) * s;
        c.beginPath(); c.ellipse(x, y, r, r * 0.28, 0, 0, TAU); c.stroke();
      }
      if (t < 24) {   // the column, foam at its foot
        const k = t / 24, h = 76 * Math.sin(Math.min(1, k * 2.2) * Math.PI * 0.5) * (1 - k * k) * s, w = (12 - 5 * k) * s;
        c.globalAlpha = 0.92 * (1 - k * 0.5);
        c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 0.35, y - h * 0.65, x - w * 0.25, y - h); c.quadraticCurveTo(x, y - h - 6 * s, x + w * 0.25, y - h);
        c.quadraticCurveTo(x + w * 0.35, y - h * 0.65, x + w, y); c.closePath(); c.fill();
        c.beginPath(); c.ellipse(x, y, w * 1.9, w * 0.45, 0, 0, TAU); c.fill();
      }
      if (t < 34) {   // the drops, gravity 0.3 px a tick
        c.globalAlpha = Math.min(1, (34 - t) / 10);
        for (const d of q.drops) {
          const dx = x + d.vx * t * s, dy = y - 6 * s + (d.vy * t + 0.15 * t * t) * s;
          if (dy > y) continue;
          c.beginPath(); c.ellipse(dx, dy, d.r * s * 0.8, d.r * s, 0, 0, TAU); c.fill();
        }
      }
    }
    c.restore();
  }

  // ---- once per sim frame: the splash clock, the duck, quiet ambience (birds, a breeze) ----
  function tick(g, live) {
    if (C.g !== g) { C.g = g; C.splash.length = 0; C.flap = 0; }   // a new game (or the menu's attract match): no leftover splash
    for (let i = C.splash.length - 1; i >= 0; i--) if (++C.splash[i].t >= 40) C.splash.splice(i, 1);
    if (C.flap > 0) C.flap--;
    if (!live) return;
    if (--C.bird <= 0) { C.bird = 360 + Math.random() * 240; birds(); }
    if (--C.gust <= 0) { C.gust = 420 + Math.random() * 120; gust(); }
  }
  function ko(e, live) {
    if (!(e.y > STAGE.blast.bottom - 40)) return;   // only a fall into the moat
    C.splash.push({ x: e.x, t: 0, drops: Array.from({ length: 10 }, (_, i) => ({ vx: (i - 4.5) * 1.05 + (Math.random() - 0.5) * 0.6, vy: -(3.6 + Math.random() * 1.8 - Math.abs(i - 4.5) * 0.12), r: 3 + Math.random() * 2.5 })) });
    if (C.duckOn) C.flap = 16;   // the duck flaps once when the water goes up (ticks 10..1)
    if (live) Sfx.later(100, () => { Sfx.noise(0.15, 0.2, 566); Sfx.tone(302, 104, 0.18, "sine", 0.2); });   // the plop (a semitone under the bay's), with the splash
  }
  // birds: two or three short high chirps, very quiet (about -34 dB)
  function birds() {
    if (!Sfx.ok()) return;
    const n = 2 + (Math.random() < 0.5 ? 1 : 0), f = 2200 + Math.random() * 600;
    for (let i = 0; i < n; i++) Sfx.later(i * (70 + Math.random() * 50), () => Sfx.tone(f * (1 + i * 0.04), f * (1.12 + i * 0.04), 0.04, "sine", 0.02));
  }
  // a breeze: low-passed noise swelling up and down over 7 s (one source at a time, stopped when the match pauses or ends)
  function gust() {
    if (!Sfx.ok() || C.gustSrc) return;
    try {
      const a = Sfx.ctx, t = a.currentTime, src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      src.buffer = Sfx.noiseBuf; src.loop = true; f.type = "lowpass"; f.frequency.value = 300;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + 3.5); g.gain.linearRampToValueAtTime(0.0001, t + 7);
      src.connect(f); f.connect(g); g.connect(Sfx.out); src.start(t, Math.random() * 0.5); src.stop(t + 7.05);
      C.gustSrc = { src, g }; src.onended = () => { if (C.gustSrc && C.gustSrc.src === src) C.gustSrc = null; };
    } catch (e) { C.gustSrc = null; }
  }
  function gustStop() {
    const q = C.gustSrc; C.gustSrc = null;
    try { const t = Sfx.ctx.currentTime; q.g.gain.cancelScheduledValues(t); q.g.gain.setTargetAtTime(0.0001, t, 0.05); q.src.stop(t + 0.3); } catch (e) { /* already stopped */ }
  }

  return { name: "Hashbrown Keep", bg, stage, tick, ko };
})();
