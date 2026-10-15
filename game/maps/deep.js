/* ---- The Deep (map "deep"; Fable's design /mnt/project-files/bosses2/fable-design.md section 4): Kraken Spud's arena, also a normal map.
   A long jetty at night in a storm, the harbour end left, the open sea right. bg (screen space, back to front): the sky (twelve faint
   stars, three long storm clouds drifting, lightning every 10-16 s: the sky flashes twice with a bolt far right, a rumble 600 ms later),
   the far shore (a harbour wall and Spudset Bay's salt-shaker lighthouse seen from the sea side, its beam sweeping round; two buoys
   with a bell), the sea (three wave rows, ten teal specks that glow, a fish leaping every 14 s), the fog on the horizon, a lobster-pot
   buoy close by. stage (world space): six piles down into the water (barnacles, foam at the water line), the Kraken's tells rising from
   behind the pier (draw-kraken.js krBehind), a rope rail along the far edge, a lantern post at the harbour end, the jetty (plank ends,
   a stringer, three cross beams, a wet sheen, iron cleats at the ledges); the platforms: two crates (left) and two lobster pots (right),
   each pair hanging from a crane rope (a red claw waves out of a pot every 5 s: the joke). A boss fight (Kraken Spud on stage): twice the
   fog, a teal glow at the sea end, no foghorn but a low drone and bubbles; Nightmare: fog banks over both ends. ko: a bottom KO is a dark
   splash on the water at the bottom edge (a ring, eight drops, three teal specks) with a plop and three blups. Upright: the lighthouse at
   gw*0.12, two clouds, four wave rows, four piles. UI only: reads RG / the game, never writes it. Gradients are cached by
   (gw, gh, round(hz), boss); clouds, fog and glows are sprites; no shadowBlur. */
MAP_ART.deep = (() => {
  const TAU = Math.PI * 2;
  const C = {
    sky0: "#060a1c", sky1: "#10203c", sky2: "#1e3a4a", cloud: "#0c1428", sea0: "#0b2238", sea1: "#07192c", sea2: "#04101e", foam: "#bfe8e0",
    glow: "#3ef2c0", plank: "#5a3e2a", plankDk: "#3a2a1e", lip: "#7a5a3c", lipLt: "#9a7a56", iron: "#3b3f4a", ironLt: "#9aa3ab", rope: "#c9b28a",
    lantern: "#ffb347", crate: "#8b6a3e", crateDk: "#5e4426", crateTop: "#a98a58", wire: "#5c6a5a", wireTop: "#8a9a8a", buoy: "#c23f3a",
    buoyW: "#e3dccb", shore: "#0d1828", claw: "#d8452f",
  };
  const K = { key: "", sky: null, sea: null, fog: null, gr: new WeakMap(), rg: null, boss: null, lamp: null, teal: null, white: null, cloud: null, cloudLit: null,
    wisp: null, g: null, boltT: -999, nextBolt: 0, bolt: null, rumble: 0, fishT: -9999, nextFish: 0, fishX: 0.5, clawT: -9999, splash: [] };
  const hash = (n) => { const x = Math.sin(n * 91.73 + 17.31) * 43758.5453; return x - Math.floor(x); };
  const STARS12 = Array.from({ length: 12 }, (_, i) => ({ x: hash(i * 3.1 + 1), y: 0.04 + hash(i * 5.7 + 2) * 0.46, r: 0.8 + hash(i * 7.3 + 3) * 0.6, a: 0.22 + hash(i * 2.9) * 0.3 }));
  const SPECKS = Array.from({ length: 10 }, (_, i) => ({ x: hash(i * 4.3 + 7), y: 0.32 + hash(i * 6.1 + 5) * 0.6, r: 1 + hash(i * 2.3 + 1), per: 120 + hash(i * 8.7) * 120, ph: hash(i * 1.9) }));

  // the boss on stage in the game drawn this frame (cached per game)
  function bossOf() {
    if (K.rg !== RG) { K.rg = RG; K.boss = RG ? RG.fighters.find((f) => f.spec.boss) || null : null; }
    return K.boss;
  }
  function sprite(w, h, draw) { const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h)); draw(cv.getContext("2d"), cv.width, cv.height); return cv; }
  function glowSprite(r, g, b) {
    return sprite(96, 96, (x, S) => {
      const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.45, `rgba(${r},${g},${b},0.42)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, S, S);
    });
  }
  // one long flat storm cloud (eight puffs), a faint moonlit top edge; the lit copy is the same cloud in a lightning flash
  function cloudSprite(lit) {
    const W = 360, H = 80, E = [[0.5, 0.66, 0.46, 0.16], [0.1, 0.62, 0.09, 0.15], [0.22, 0.52, 0.13, 0.27], [0.36, 0.42, 0.14, 0.34], [0.52, 0.38, 0.13, 0.36], [0.66, 0.46, 0.13, 0.3], [0.8, 0.56, 0.12, 0.22], [0.9, 0.64, 0.08, 0.14]];
    return sprite(W, H, (x) => {
      const blob = (dy) => { x.beginPath(); for (const [a, b, rx, ry] of E) { x.moveTo(a * W + rx * W, b * H + dy); x.ellipse(a * W, b * H + dy, rx * W, ry * H, 0, 0, TAU); } x.fill(); };
      x.fillStyle = lit ? "rgba(150,180,220,0.9)" : "rgba(60,84,118,0.55)"; blob(-3);   // the lit top edge
      x.fillStyle = lit ? "#3a5578" : C.cloud; blob(0);
      x.globalCompositeOperation = "source-atop"; x.fillStyle = lit ? "rgba(20,30,60,0.3)" : "rgba(4,6,16,0.4)"; blob(9);   // darker underside
    });
  }
  // a soft fog wisp
  function wispSprite() {
    return sprite(256, 48, (x, W, H) => {
      x.save(); x.scale(1, H / W);
      const gr = x.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
      gr.addColorStop(0, "rgba(140,175,195,1)"); gr.addColorStop(0.6, "rgba(140,175,195,0.45)"); gr.addColorStop(1, "rgba(140,175,195,0)");
      x.fillStyle = gr; x.fillRect(0, 0, W, W); x.restore();
    });
  }
  function sprites() {
    if (K.lamp) return;
    K.lamp = glowSprite(255, 180, 70); K.teal = glowSprite(62, 242, 192); K.white = glowSprite(255, 240, 210);
    K.cloud = cloudSprite(false); K.cloudLit = cloudSprite(true); K.wisp = wispSprite();
  }
  const glow = (c, spr, x, y, rx, ry, a) => { if (a <= 0) return; const ga = c.globalAlpha; c.globalAlpha = ga * Math.min(1, a); c.drawImage(spr, x - rx, y - ry, rx * 2, ry * 2); c.globalAlpha = ga; };
  function grads(c, gw, gh, hz, u, boss) {
    const key = gw + "," + gh + "," + Math.round(hz) + "," + boss;
    if (K.key === key) return;
    K.key = key;
    K.sky = c.createLinearGradient(0, 0, 0, hz); K.sky.addColorStop(0, C.sky0); K.sky.addColorStop(0.6, C.sky1); K.sky.addColorStop(1, C.sky2);
    K.sea = c.createLinearGradient(0, hz, 0, gh); K.sea.addColorStop(0, C.sea0); K.sea.addColorStop(0.4, C.sea1); K.sea.addColorStop(1, C.sea2);
    const fu = boss ? 2 : 1, a = boss ? 0.2 : 0.12, y0 = hz - u * 0.04 * fu, y1 = hz + u * 0.02 * fu;
    K.fog = c.createLinearGradient(0, y0, 0, y1); K.fog.addColorStop(0, "rgba(120,160,180,0)"); K.fog.addColorStop(0.62, `rgba(120,160,180,${a})`); K.fog.addColorStop(1, "rgba(120,160,180,0)");
    K.fogY = [y0, y1];
  }
  // lightning: the sky flashes for 3 ticks, twice (4 apart)
  const flashK = () => { const d = tick - K.boltT; return d >= 0 && (d < 3 || (d >= 7 && d < 10)) ? 1 : 0; };

  // ---- bg pieces (screen space) ----
  // the salt-shaker lighthouse at night (the same shaker as Spudset Bay's, seen from the sea): (x, base) its foot, h its height; returns the lamp
  function shaker(c, x, base, h, s) {
    const bw = h * 0.6, tw = h * 0.48, gh = h * 0.66, top = base - gh, ol = Math.max(1, h * 0.05);
    c.lineJoin = "round";
    c.beginPath(); c.moveTo(x - bw / 2, base); c.lineTo(x - tw / 2, top); c.lineTo(x + tw / 2, top); c.lineTo(x + bw / 2, base); c.closePath();
    c.fillStyle = "#26364a"; c.fill();
    c.fillStyle = "#7a8698"; c.beginPath(); c.moveTo(x - bw / 2, base); c.lineTo(x - bw / 2 + (bw - tw) * 0.35, base - gh * 0.62); c.lineTo(x + bw / 2 - (bw - tw) * 0.35, base - gh * 0.62); c.lineTo(x + bw / 2, base); c.closePath(); c.fill();
    c.fillStyle = "rgba(200,220,240,0.35)"; c.fillRect(x - tw * 0.32, top + gh * 0.1, Math.max(1, h * 0.05), gh * 0.72);
    c.lineWidth = ol; c.strokeStyle = "#070b14";
    c.beginPath(); c.moveTo(x - bw / 2, base); c.lineTo(x - tw / 2, top); c.lineTo(x + tw / 2, top); c.lineTo(x + bw / 2, base); c.closePath(); c.stroke();
    c.fillStyle = "#4a5262"; c.fillRect(x - tw / 2 - h * 0.03, top - h * 0.08, tw + h * 0.06, h * 0.09);
    c.beginPath(); c.ellipse(x, top - h * 0.08, tw / 2, h * 0.22, 0, Math.PI, TAU); c.fillStyle = "#5a6272"; c.fill(); c.stroke();
    c.fillStyle = "#070b14";
    for (const [dx, dy] of [[-0.14, 0.13], [0.14, 0.13], [-0.08, 0.2], [0.08, 0.2]]) { c.beginPath(); c.arc(x + dx * h, top - h * dy, Math.max(0.7, h * 0.03), 0, TAU); c.fill(); }
    return [x, top - h * 0.17];
  }
  // a channel buoy on the horizon: a red cone, a bell cage, a light
  function farBuoy(c, x, y, s, tk, seed) {
    const b = Math.sin(tk * 0.03 + seed) * 1.2 * s, h = 10 * s;
    c.save(); c.translate(x, y + b); c.rotate(Math.sin(tk * 0.025 + seed) * 0.08);
    c.fillStyle = "#3a1a20"; c.fillRect(-h * 0.5, -h * 0.25, h, h * 0.35);
    c.fillStyle = "#7a2a28"; c.beginPath(); c.moveTo(-h * 0.42, -h * 0.25); c.lineTo(0, -h * 1.2); c.lineTo(h * 0.42, -h * 0.25); c.closePath(); c.fill();
    c.strokeStyle = "#1a1418"; c.lineWidth = Math.max(0.8, s * 0.8); c.beginPath(); c.moveTo(-h * 0.25, -h * 0.6); c.lineTo(h * 0.25, -h * 0.6); c.stroke();
    c.restore();
    if (((tk + seed * 97) % 150) < 40) glow(c, K.lamp, x, y + b - h * 1.25, 5 * s, 5 * s, 0.9);
  }
  // the lobster-pot buoy close by: red float, a white band, a flag on a stick
  function nearBuoy(c, x, y, r, tk, s) {
    c.fillStyle = "rgba(191,232,224,0.22)"; c.beginPath(); c.ellipse(x, y + r * 0.3, r * 1.7, r * 0.35, 0, 0, TAU); c.fill();
    c.save(); c.translate(x, y); c.rotate(Math.sin(tk * 0.04) * 0.12);
    c.strokeStyle = OUT; c.lineWidth = Math.max(1, r * 0.12);
    c.beginPath(); c.moveTo(0, -r * 0.8); c.lineTo(0, -r * 2.4); c.stroke();
    const fl = Math.sin(tk * 0.15) * r * 0.12;
    c.fillStyle = C.buoy; c.beginPath(); c.moveTo(0, -r * 2.4); c.quadraticCurveTo(r * 0.5, -r * 2.25 + fl, r * 0.95, -r * 2.15 + fl); c.lineTo(0, -r * 1.85); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, -r * 0.1, r, r * 0.78, 0, 0, TAU); c.fillStyle = C.buoy; c.fill();
    c.save(); c.clip(); c.fillStyle = C.buoyW; c.fillRect(-r, -r * 0.42, r * 2, r * 0.34); c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(-r, r * 0.25, r * 2, r); c.restore();
    c.stroke();
    c.restore();
  }
  // a fish leaping out of the water and back in (k 0..1 over the leap)
  function fish(c, x, y, h, k, s) {
    const fx = x + h * 1.2 * k, fy = y - h * Math.sin(k * Math.PI), a = Math.atan2(-Math.cos(k * Math.PI) * Math.PI * h, h * 1.2);
    c.save(); c.translate(fx, fy); c.rotate(-a);
    const L = 9 * s;
    c.fillStyle = "#3a5a6a"; c.strokeStyle = "#0a141c"; c.lineWidth = Math.max(0.8, s * 0.8);
    c.beginPath(); c.ellipse(0, 0, L, L * 0.38, 0, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-L * 0.85, 0); c.lineTo(-L * 1.45, -L * 0.42); c.lineTo(-L * 1.45, L * 0.42); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = C.glow; c.beginPath(); c.arc(L * 0.5, -L * 0.08, Math.max(0.8, L * 0.1), 0, TAU); c.fill();
    c.restore();
  }

  function bg(c, tk) {
    const gw = L.gw, gh = L.gh, u = Math.min(gw, gh), s = u / 390, up = L.portrait, z = cam.z, b = bossOf(), boss = !!b;
    let hz = gh * 0.7 - (cam.y + 110) * z * 0.16;
    if (up && STAGE.main) hz = Math.min(hz, toScreen(0, STAGE.main.top)[1] - u * 0.03);
    const P = (k) => -cam.x * z * k, fl = flashK();
    sprites(); grads(c, gw, gh, hz, u, boss);
    c.lineCap = "round"; c.lineJoin = "round";
    // 1. the sky, its stars; a lightning flash lifts it to #2a4060
    c.fillStyle = K.sky; c.fillRect(0, 0, gw, Math.max(0, hz) + 1);
    if (fl) { c.fillStyle = "rgba(42,64,96,0.85)"; c.fillRect(0, 0, gw, Math.max(0, hz) + 1); }
    for (const st of STARS12) {
      const x = (((st.x * gw + P(0.02)) % gw) + gw) % gw, y = st.y * hz;
      c.fillStyle = `rgba(220,232,255,${(st.a * (0.75 + 0.25 * Math.sin(tk * 0.02 + st.x * 40))).toFixed(3)})`; c.fillRect(x, y, st.r * Math.max(1, s), st.r * Math.max(1, s));
    }
    // the bolt, far right, while the sky flashes
    if (fl && K.bolt) {
      const bx = gw * K.bolt[0], pts = [[bx, -2], [bx + K.bolt[1] * u * 0.05, hz * 0.22], [bx - K.bolt[2] * u * 0.04, hz * 0.4], [bx + K.bolt[3] * u * 0.03, hz * 0.62]];
      c.strokeStyle = "rgba(150,190,255,0.35)"; c.lineWidth = Math.max(4, 7 * s); c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      c.strokeStyle = "rgba(220,240,255,0.8)"; c.lineWidth = Math.max(1.5, 2.4 * s); c.stroke();
    }
    // three long clouds drifting right (k 0.03); upright two
    const CL = up ? [[0.9, 0.18, 0.1], [0.7, 0.4, 0.6]] : [[0.95, 0.14, 0.1], [0.62, 0.3, 0.58], [0.78, 0.46, 0.33]];
    const spr = fl ? K.cloudLit : K.cloud;
    CL.forEach(([w, yk, x0], i) => {
      const cw = u * w, ch = cw * 0.22, span = gw + cw, x = ((((x0 * gw + tk * 0.04 * s + P(0.03)) % span) + span) % span) - cw;
      if (i % 2) { c.save(); c.translate(x + cw, 0); c.scale(-1, 1); c.drawImage(spr, 0, hz * yk - ch / 2, cw, ch); c.restore(); }
      else c.drawImage(spr, x, hz * yk - ch / 2, cw, ch);
    });
    // 2. the far shore (k 0.06): the harbour wall at the left, a shed with a lit window, the salt-shaker lighthouse on the wall's end
    const wx1 = gw * (up ? 0.3 : 0.27) + P(0.06), wh = u * 0.032, shH = u * (up ? 0.06 : 0.08), lhx = up ? gw * 0.12 + P(0.06) : wx1 - u * 0.05;
    c.fillStyle = C.shore;
    c.beginPath(); c.moveTo(-4, hz + 1); c.lineTo(-4, hz - wh * 1.35); c.lineTo(wx1 - u * 0.12, hz - wh * 1.35); c.lineTo(wx1 - u * 0.11, hz - wh); c.lineTo(wx1, hz - wh); c.lineTo(wx1 + u * 0.015, hz + 1); c.closePath(); c.fill();
    const sx = up ? gw * 0.24 + P(0.06) : gw * 0.1 + P(0.06), sw = u * 0.06, sh = u * 0.04;
    c.beginPath(); c.moveTo(sx - sw / 2, hz - wh * 1.3); c.lineTo(sx - sw / 2, hz - wh * 1.3 - sh); c.lineTo(sx, hz - wh * 1.3 - sh * 1.45); c.lineTo(sx + sw / 2, hz - wh * 1.3 - sh); c.lineTo(sx + sw / 2, hz - wh * 1.3); c.fill();
    c.fillStyle = "rgba(255,179,71,0.85)"; c.fillRect(sx - sw * 0.25, hz - wh * 1.3 - sh * 0.7, sw * 0.16, sh * 0.32); c.fillRect(sx + sw * 0.1, hz - wh * 1.3 - sh * 0.7, sw * 0.16, sh * 0.32);
    // its beam sweeps round: long when it points sideways, a flash of the lamp when it points at you
    const th = tk * 0.02, cs = Math.cos(th), sn = Math.sin(th), [lx, ly] = [lhx, hz - wh - shH * 0.83];
    if (Math.abs(cs) > 0.04) {
      const len = u * 1.3 * Math.abs(cs), d = Math.sign(cs), gr = c.createLinearGradient(lx, 0, lx + d * len, 0);
      gr.addColorStop(0, "rgba(255,230,180,0.16)"); gr.addColorStop(1, "rgba(255,230,180,0)");
      c.fillStyle = gr; c.beginPath(); c.moveTo(lx, ly - 1); c.lineTo(lx + d * len, ly - len * 0.2); c.lineTo(lx + d * len, ly + len * 0.16); c.closePath(); c.fill();
    }
    shaker(c, lhx, hz - wh, shH, s);
    glow(c, K.white, lx, ly, shH * (0.45 + (sn > 0.85 ? (sn - 0.85) * 8 : 0)), shH * (0.45 + (sn > 0.85 ? (sn - 0.85) * 8 : 0)), 0.9);
    // two buoys out on the water (k 0.1), a bell rings every 7 s (tick)
    farBuoy(c, gw * 0.52 + P(0.1), hz + u * 0.006, s, tk, 0.7);
    if (!up) farBuoy(c, gw * 0.7 + P(0.1), hz + u * 0.01, s * 0.85, tk, 2.1);
    // 4. the sea
    c.fillStyle = K.sea; c.fillRect(0, hz, gw, gh - hz + 1);
    // 3. the fog on the horizon (k 0.08): a band and three wisps drifting (twice as thick in a boss fight)
    c.fillStyle = K.fog; c.fillRect(0, K.fogY[0], gw, K.fogY[1] - K.fogY[0]);
    for (let i = 0; i < 3; i++) {
      const ww = u * (0.8 + i * 0.25), span = gw + ww, x = ((((i * 0.37 * gw + tk * 0.04 * s * (i % 2 ? 1 : 0.7) + P(0.08)) % span) + span) % span) - ww;
      glow(c, K.wisp, x + ww / 2, hz - u * (0.012 - i * 0.008), ww / 2, u * (boss ? 0.05 : 0.026), boss ? 0.22 : 0.12);
    }
    // wave rows sliding left (each with its own parallax); upright four
    const WV = [[0.05, 0.12, 0.25, 0.5, 1.6, 0.22], [0.12, 0.2, 0.4, 0.62, 2.2, 0.22], [0.22, 0.28, 0.55, 0.75, 2.8, 0.22]];
    if (up) WV.push([0.36, 0.34, 0.65, 0.85, 3.2, 0.2]);
    const bw = gw / 10;
    c.lineWidth = 1.5;
    WV.forEach(([yk, k, sp, wk, amp, al], row) => {
      const y = hz + u * yk;
      if (y > gh) return;
      const off = tk * sp * s - P(k), j0 = Math.floor(off / bw) - 1, j1 = Math.floor((off + gw) / bw) + 1;
      c.strokeStyle = `rgba(190,232,224,${al})`; c.beginPath();
      for (let j = j0; j <= j1; j++) {
        const n = nz(j * 3.7 + row * 11.3);
        if (n < 0.28) continue;
        const w = bw * wk * (0.7 + 0.3 * n), x = j * bw - off + (n - 0.5) * bw * 0.4, a = amp * s * (0.75 + 0.25 * n);
        c.moveTo(x, y); c.quadraticCurveTo(x + w / 2, y - a * 2, x + w, y);
      }
      c.stroke();
    });
    // ten teal specks in the near water, glowing on their own clocks
    for (const q of SPECKS) {
      const span = gw * 1.2, x = ((((q.x * span + P(0.4)) % span) + span) % span) - gw * 0.1, y = hz + (gh - hz) * q.y;
      const a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin((tk / q.per + q.ph) * TAU)), r = q.r * Math.max(1, s);
      glow(c, K.teal, x, y, r * 4, r * 4, a * 0.5);
      c.fillStyle = `rgba(62,242,192,${a.toFixed(3)})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    // a fish leaps every 14 s
    const fk = (tick - K.fishT) / 40;
    if (fk >= 0 && fk <= 1) {
      const fx0 = gw * K.fishX, fy0 = hz + (gh - hz) * 0.28, fh = u * 0.05;
      fish(c, fx0, fy0, fh, fk, s);
      for (const [x0, k0] of [[fx0, 0], [fx0 + fh * 1.2, 0.85]]) {
        const q = (fk - k0) / 0.35;
        if (q < 0 || q > 1) continue;
        c.strokeStyle = `rgba(191,232,224,${(0.6 * (1 - q)).toFixed(3)})`; c.lineWidth = Math.max(1, 1.5 * s);
        c.beginPath(); c.ellipse(x0, fy0, (3 + 12 * q) * s, (1 + 3 * q) * s, 0, 0, TAU); c.stroke();
      }
    }
    // 5. near (k 0.6): the lobster-pot buoy
    const nbx = gw * 0.08 + P(0.6), nby = hz + u * (up ? 0.24 : 0.2) + Math.sin(tk * 0.035) * 2 * s;
    if (nbx > -u * 0.1 && nbx < gw + u * 0.1 && nby < gh + u * 0.05) nearBuoy(c, nbx, nby, u * 0.026, tk, s);
    c.lineCap = "butt"; c.lineJoin = "miter";
  }

  // ---- the stage (world space): the jetty ----
  function grads2(c) {
    let G0 = K.gr.get(c);
    if (!G0) {
      const S = STAGE.main, g = c.createLinearGradient(0, S.top, 0, S.bottom);
      g.addColorStop(0, C.plank); g.addColorStop(1, C.plankDk);
      G0 = { body: g };
      K.gr.set(c, G0);
    }
    return G0;
  }
  // a pile: a dark post from under the jetty into the water (y 64 -> 200), barnacle rings near the water line (y 120), foam round it
  function pile(c, x, tk, i) {
    const top = STAGE.main.bottom - 2, wl = 100;   // the water line (KR_SEA_Y in draw-kraken.js)
    c.fillStyle = C.plankDk; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.rect(x - 7, top, 14, 200 - top); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,230,190,0.08)"; c.fillRect(x - 5, top + 2, 3, wl - top - 4);
    c.fillStyle = "rgba(4,16,30,0.55)"; c.fillRect(x - 7, wl, 14, 200 - wl);   // under the water
    c.fillStyle = "#d9d2c0"; c.lineWidth = 1;
    for (const [dx, dy, r] of [[-4, wl - 6, 2.2], [3, wl - 12, 1.8], [-1, wl - 18, 1.6], [4, wl - 3, 2]]) { c.beginPath(); c.arc(x + dx, dy + (i % 2) * 2, r, 0, TAU); c.fill(); c.stroke(); }
    const f = 1 + 0.12 * Math.sin(tk * 0.05 + i * 1.7);
    c.strokeStyle = "rgba(191,232,224,0.55)"; c.lineWidth = 2; c.beginPath(); c.ellipse(x, wl, 13 * f, 3 * f, 0, 0, TAU); c.stroke();
  }
  // a crane rope down to a hook and two slings to the load's corners (the crates and the pots hang over the pier)
  function sling(c, p, hop) {
    const cx = (p.x1 + p.x2) / 2, hy = p.y - 44 + hop;
    c.lineCap = "round";
    for (const [w, col] of [[3.6, OUT], [1.8, C.rope]]) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      c.moveTo(cx, hy - 900); c.lineTo(cx, hy - 6);
      c.moveTo(cx, hy); c.lineTo(p.x1 + 8, p.y - 1 + hop); c.moveTo(cx, hy); c.lineTo(p.x2 - 8, p.y - 1 + hop);
      c.stroke();
    }
    c.strokeStyle = OUT; c.lineWidth = 3.4; c.beginPath(); c.arc(cx, hy - 2, 4.5, -0.4, Math.PI + 0.6); c.stroke();
    c.strokeStyle = C.ironLt; c.lineWidth = 1.6; c.stroke();
  }
  function crates(c, p, hop) {
    const pw = p.x2 - p.x1, cx = (p.x1 + p.x2) / 2, y = p.y + hop;
    glow(c, K.teal, cx, p.y + 46, pw * 0.5, 12, 0.18);
    sling(c, p, hop);
    c.strokeStyle = OUT; c.lineWidth = 2.5;
    for (let i = 0; i < 2; i++) {
      const x0 = p.x1 + 2 + i * (pw / 2), w = pw / 2 - 4, y0 = y + 8, h = 30;
      c.fillStyle = C.crate; c.beginPath(); c.rect(x0, y0, w, h); c.fill(); c.stroke();
      c.strokeStyle = C.crateDk; c.lineWidth = 3; c.strokeRect(x0 + 2.5, y0 + 2.5, w - 5, h - 5);
      c.beginPath(); c.moveTo(x0 + 4, y0 + h - 4); c.lineTo(x0 + w - 4, y0 + 4); c.stroke();
      // the stencilled potato
      const px_ = x0 + w * (i ? 0.62 : 0.4), py_ = y0 + h * 0.5;
      c.strokeStyle = "rgba(17,16,28,0.75)"; c.lineWidth = 1.4; c.beginPath(); c.ellipse(px_, py_, 7.5, 6, 0.25, 0, TAU); c.stroke();
      c.fillStyle = "rgba(17,16,28,0.75)"; c.beginPath(); c.arc(px_ - 2.4, py_ - 1, 1.1, 0, TAU); c.arc(px_ + 2.4, py_ - 1.4, 1.1, 0, TAU); c.fill();
      c.strokeStyle = OUT; c.lineWidth = 2.5;
    }
    // the lids: the 11-unit standing top
    c.beginPath(); c.roundRect(p.x1, y - 1, pw, 11, 3);
    c.fillStyle = C.crate; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = C.crateTop; c.fillRect(p.x1 + 4, y, pw - 8, 2.5);
    c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(cx - 1, y + 1, 2, 8);
  }
  function pots(c, p, tk, hop) {
    const pw = p.x2 - p.x1, cx = (p.x1 + p.x2) / 2, y = p.y + hop;
    glow(c, K.teal, cx, p.y + 46, pw * 0.5, 12, 0.18);
    sling(c, p, hop);
    // the claw waves out of the right pot every 5 s (behind its mesh)
    const ct = tick - K.clawT;
    if (ct >= 0 && ct < 70) {
      const out = Math.min(1, ct / 10, (70 - ct) / 10), wv = Math.sin(ct * 0.45) * 0.5, snap = (ct >> 3) & 1;
      const bx = p.x2 - 18, by = y + 26;
      c.save(); c.translate(bx, by); c.rotate(-0.5 + wv);
      c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(16 * out, -6 * out); c.stroke();
      c.strokeStyle = C.claw; c.lineWidth = 3.4; c.stroke();
      c.translate(16 * out, -6 * out); c.fillStyle = C.claw; c.strokeStyle = OUT; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(4, 0, 6, 4.4, 0, 0, TAU); c.fill(); c.stroke();
      for (const s of [-1, 1]) { c.save(); c.translate(8, s * 1.5); c.rotate(s * (snap ? 0.5 : 0.15)); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(7, s * 3, 11, s * 0.5); c.quadraticCurveTo(6, s * 0.2, 0, 0); c.fill(); c.stroke(); c.restore(); }
      c.restore();
    }
    for (let i = 0; i < 2; i++) {
      const x0 = p.x1 + 2 + i * (pw / 2), w = pw / 2 - 4, y0 = y + 6, h = 30;
      // the cage: dark inside, a wire mesh, two hoops, the funnel mouth
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + w, y0); c.lineTo(x0 + w, y0 + h - 8); c.quadraticCurveTo(x0 + w, y0 + h, x0 + w - 8, y0 + h); c.lineTo(x0 + 8, y0 + h); c.quadraticCurveTo(x0, y0 + h, x0, y0 + h - 8); c.closePath();
      c.fillStyle = "rgba(10,20,24,0.55)"; c.fill();
      c.save(); c.clip();
      c.strokeStyle = C.wire; c.lineWidth = 1.2; c.beginPath();
      for (let k = -h; k < w + h; k += 7) { c.moveTo(x0 + k, y0); c.lineTo(x0 + k + h, y0 + h); c.moveTo(x0 + k + h, y0); c.lineTo(x0 + k, y0 + h); }
      c.stroke();
      c.fillStyle = "rgba(20,30,34,0.85)"; c.beginPath(); c.ellipse(x0 + w * 0.5, y0 + h * 0.55, w * 0.18, h * 0.24, 0, 0, TAU); c.fill();
      c.restore();
      c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
      c.strokeStyle = C.wireTop; c.lineWidth = 1.6; c.beginPath();
      for (const q of [0.25, 0.75]) { c.moveTo(x0 + w * q, y0 + 1); c.lineTo(x0 + w * q, y0 + h - 1); }
      c.stroke();
    }
    // the tops: the 11-unit standing frame
    c.beginPath(); c.roundRect(p.x1, y - 1, pw, 11, 3);
    c.fillStyle = C.wire; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = C.wireTop; c.fillRect(p.x1 + 4, y, pw - 8, 2.5);
    c.strokeStyle = "rgba(17,16,28,0.45)"; c.lineWidth = 1; c.beginPath();
    for (let x = p.x1 + 6; x < p.x2 - 4; x += 6) { c.moveTo(x, y + 3.5); c.lineTo(x + 3, y + 8.5); }
    c.stroke();
  }
  function stage(c, tk) {
    const S = STAGE.main, x1 = S.x1, x2 = S.x2, w = x2 - x1, top = S.top, bot = S.bottom, b = bossOf(), up = L.portrait;
    sprites();
    c.lineCap = "round"; c.lineJoin = "round";
    // a boss fight: the sea end glows teal
    if (b) glow(c, K.teal, x2 + 70, top - 50, 170, 150, 0.16 + 0.03 * Math.sin(tk * 0.04));
    // the Kraken's tells rising from the water behind the pier (draw-kraken.js)
    if (b && b.spec.id === "kraken") krBehind(c, RG, b, tk);
    // the piles (four upright)
    (up ? [-300, -100, 100, 300] : [-330, -200, -70, 70, 200, 330]).forEach((x, i) => pile(c, x, tk, i));
    // Nightmare against him: fog banks over both ends of the pier
    if (b && RG && RG.lv === 2 && b.state !== "broken" && !b.doomed) {
      for (const sd of [-1, 1]) glow(c, K.wisp, sd * 470, top - 70, 240, 150, 0.35 + 0.05 * Math.sin(tk * 0.02 + sd));
    }
    // the rope rail along the far edge, behind the fighters (five short posts)
    const RP = [-290, -145, 0, 145, 290];
    c.globalAlpha = 0.85;
    c.strokeStyle = OUT; c.lineWidth = 3.4; c.beginPath();
    for (let i = 0; i < RP.length - 1; i++) { c.moveTo(RP[i], top - 16); c.quadraticCurveTo((RP[i] + RP[i + 1]) / 2, top - 8, RP[i + 1], top - 16); }
    c.stroke(); c.strokeStyle = C.rope; c.lineWidth = 1.6; c.stroke();
    for (const x of RP) { c.fillStyle = C.plankDk; c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.rect(x - 2.5, top - 20, 5, 20); c.fill(); c.stroke(); }
    c.globalAlpha = 1;
    // the lantern post at the harbour end, its lantern swinging
    const lpx = -340, sw = Math.sin((tk / 160) * TAU) * 0.05;
    c.fillStyle = C.plankDk; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.rect(lpx - 3, top - 90, 6, 90); c.fill(); c.stroke();
    c.beginPath(); c.rect(lpx - 3, top - 90, 20, 4); c.fill(); c.stroke();
    const flick = 0.9 + 0.1 * Math.sin(tk * 0.7) * Math.sin(tk * 0.23);
    glow(c, K.lamp, lpx + 14, top - 70, 62, 62, 0.32 * flick);
    c.save(); c.translate(lpx + 14, top - 86); c.rotate(sw);
    c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 6); c.stroke();
    c.fillStyle = C.lantern; c.beginPath(); c.roundRect(-5, 6, 10, 13, 2); c.fill(); c.lineWidth = 1.6; c.stroke();
    c.fillStyle = "#fff2c8"; c.fillRect(-2, 9, 4, 7);
    c.fillStyle = C.iron; c.beginPath(); c.moveTo(-6.5, 6); c.lineTo(0, 1.5); c.lineTo(6.5, 6); c.closePath(); c.fill(); c.stroke();
    c.fillRect(-5.5, 18, 11, 2.5);
    c.restore();
    // the jetty: plank ends over a stringer and three cross beams, a wet sheen, drips off its underside
    c.beginPath(); c.rect(x1, top, w, bot - top);
    c.fillStyle = grads2(c).body; c.fill();
    c.save(); c.clip();
    c.strokeStyle = "rgba(17,16,28,0.3)"; c.lineWidth = 1.5; c.beginPath();
    for (let x = x1 + 36; x < x2; x += 36) { c.moveTo(x, top + 8); c.lineTo(x, top + 30); }
    c.stroke();
    c.fillStyle = "rgba(0,0,0,0.28)"; c.fillRect(x1, top + 30, w, 3);
    c.fillStyle = "#4a3424"; c.fillRect(x1, top + 33, w, 13);
    c.fillStyle = "rgba(255,230,190,0.1)"; c.fillRect(x1, top + 33, w, 1.5);
    c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(x1, top + 46, w, bot - top - 46);
    for (const bx of [-240, 0, 240]) {
      c.fillStyle = C.plank; c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.rect(bx - 11, top + 44, 22, 18); c.fill(); c.stroke();
      c.strokeStyle = "rgba(17,16,28,0.35)"; c.lineWidth = 1; c.beginPath(); c.ellipse(bx, top + 53, 5, 4, 0, 0, TAU); c.stroke();
    }
    c.fillStyle = C.iron;
    for (let x = x1 + 60; x < x2 - 20; x += 120) { c.beginPath(); c.arc(x, top + 39.5, 2.2, 0, TAU); c.fill(); }
    c.fillStyle = "rgba(190,232,224,0.12)"; c.fillRect(x1, top + 2, w, 4);
    c.restore();
    c.lineWidth = 3; c.strokeStyle = OUT; c.strokeRect(x1, top, w, bot - top);
    c.fillStyle = "rgba(191,232,224,0.7)";
    for (let i = 0; i < 5; i++) {   // drips off the underside
      const per = 70 + i * 13, q = ((tk + i * 37) % per) / per, x = x1 + 50 + i * 150 + (i % 2) * 20;
      if (q < 0.55) { const r = 1.2 + q * 2; c.beginPath(); c.arc(x, bot + 1 + r * 0.6, r, 0, TAU); c.fill(); }
      else { const y = bot + 3 + (q - 0.55) * 160; c.beginPath(); c.ellipse(x, y, 1.4, 2.6, 0, 0, TAU); c.fill(); }
    }
    // the lip: the top plank's edge, its highlight, gaps every 36; iron cleats on the ledges
    c.beginPath(); c.roundRect(x1 - 4, top - 3, w + 8, 12, 5);
    c.fillStyle = C.lip; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = C.lipLt; c.fillRect(x1, top - 2, w, 3);
    c.strokeStyle = "rgba(17,16,28,0.35)"; c.lineWidth = 1.5; c.beginPath();
    for (let x = x1 + 36; x < x2 - 4; x += 36) { c.moveTo(x, top - 1); c.lineTo(x, top + 8); }
    c.stroke();
    for (const x of [x1 + 2, x2 - 2]) {
      c.fillStyle = C.iron; c.strokeStyle = OUT; c.lineWidth = 1.2;
      c.beginPath(); c.roundRect(x - 4, top - 6, 8, 4, 1); c.fill(); c.stroke();
      c.beginPath(); c.roundRect(x - 9, top - 8.5, 18, 3, 1.5); c.fill(); c.stroke();
      c.fillStyle = C.ironLt; c.fillRect(x - 7, top - 8, 14, 1);
    }
    // the platforms: crates (left), lobster pots (right); they hop when he is launched out (draw-kraken.js krHop)
    const hop = b && b.spec.id === "kraken" ? krHop() : 0;
    for (const p of STAGE.plats) ((p.x1 + p.x2) / 2 < 0 ? crates(c, p, hop) : pots(c, p, tk, hop * 0.8));
    c.lineCap = "butt"; c.lineJoin = "miter";
    splashes(c);
  }

  // ---- bottom KO: a dark splash on the water at the bottom edge, under where the fighter went down ----
  function ko(e, live) {
    if (!(e.y > STAGE.blast.bottom - 40)) return;
    K.splash.push({ x: e.x, t0: tick, d: Array.from({ length: 8 }, (_, i) => ({ a: -Math.PI / 2 + (i / 7 - 0.5) * 1.9 + (Math.random() - 0.5) * 0.15, v: 4 + Math.random() * 3.2, r: 2.6 + Math.random() * 2 })),
      sp: Array.from({ length: 3 }, () => ({ dx: (Math.random() - 0.5) * 50, dy: -4 - Math.random() * 14 })) });
    if (K.splash.length > 4) K.splash.shift();
    if (live && Sfx.ok()) {
      Sfx.noise(0.15, 0.2, 560); Sfx.tone(302, 104, 0.18, "sine", 0.2);
      for (let i = 0; i < 3; i++) Sfx.at(0.16 + i * 0.09, 400, 150, 0.06, "sine", 0.06);
    }
  }
  function splashes(c) {
    if (!K.splash.length) return;
    const gw = L.gw, gh = L.gh, u = Math.min(gw, gh), s = u / 390, y0 = gh - u * 0.06;
    c.save(); c.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (let i = K.splash.length - 1; i >= 0; i--) {
      const q = K.splash[i], t = tick - q.t0;
      if (t < 0 || t > 44) { K.splash.splice(i, 1); continue; }
      const x = clamp(gw / 2 + (q.x - cam.x) * cam.z, u * 0.1, gw - u * 0.1);
      if (t <= 25) {
        const k = t / 25, r = (10 + 50 * (1 - (1 - k) * (1 - k))) * s;
        c.globalAlpha = 1 - k; c.fillStyle = "rgba(4,16,30,0.5)"; c.beginPath(); c.ellipse(x, y0, r * 0.9, r * 0.26, 0, 0, TAU); c.fill();
        c.strokeStyle = C.foam; c.lineWidth = 3 * (1 - k) + 1; c.beginPath(); c.ellipse(x, y0, r, r * 0.3, 0, 0, TAU); c.stroke();
      }
      if (t <= 30) {
        c.globalAlpha = Math.min(1, (30 - t) / 10); c.fillStyle = C.foam;
        for (const d of q.d) {
          const dx = x + Math.cos(d.a) * d.v * s * t, dy = y0 + Math.sin(d.a) * d.v * s * t + 0.15 * s * t * t;
          if (dy > y0 + 4) continue;
          c.beginPath(); c.arc(dx, dy, d.r * s, 0, TAU); c.fill();
        }
      }
      // three teal specks linger 40 ticks
      c.globalAlpha = Math.min(1, (44 - t) / 12);
      for (const p of q.sp) { glow(c, K.teal, x + p.dx * s, y0 + p.dy * s - t * 0.1 * s, 6 * s, 6 * s, 0.7); c.fillStyle = C.glow; c.beginPath(); c.arc(x + p.dx * s, y0 + p.dy * s - t * 0.1 * s, 1.6 * s, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
    c.restore();
  }

  // ---- once per sim frame: lightning, the leaping fish, the claw, the quiet ambience ----
  const amb = { wave: 0, bell: 0, creak: 0, horn: 0, bed: 0, pop: 0 };
  function wash(a, t) {   // the waves: pink-ish noise low-passed at 350 Hz, swelling over 6 s (~-34 dB)
    const src = a.createBufferSource(), f = a.createBiquadFilter(), gn = a.createGain(), v = 0.026;
    src.buffer = Sfx.noiseBuf; src.loop = true; f.type = "lowpass"; f.frequency.value = 350; f.Q.value = 0.5;
    gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v * 0.3, t + 0.5); gn.gain.linearRampToValueAtTime(v, t + 3);
    gn.gain.linearRampToValueAtTime(v * 0.3, t + 5.6); gn.gain.linearRampToValueAtTime(0.0001, t + 6.2);
    src.connect(f); f.connect(gn); gn.connect(Sfx.out); src.start(t, Math.random() * 0.5); src.stop(t + 6.3);
  }
  function foghorn(a, t) {   // sine 110 Hz for 900 ms with a 2 Hz vibrato (~-32 dB)
    const o = a.createOscillator(), lfo = a.createOscillator(), lg = a.createGain(), g = a.createGain();
    o.frequency.value = 110; lfo.frequency.value = 2; lg.gain.value = 2.5; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.15); g.gain.setValueAtTime(0.03, t + 0.75); g.gain.linearRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(Sfx.out); o.start(t); lfo.start(t); o.stop(t + 0.95); lfo.stop(t + 0.95);
  }
  function drone(a, t) {   // a boss fight: sines at 48 and 72 Hz (~-38 dB), 1.5 s beds laid every second with soft fades
    const D = 1.5, g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.5); g.gain.setValueAtTime(1, t + D - 0.5); g.gain.linearRampToValueAtTime(0.0001, t + D);
    g.connect(Sfx.out);
    for (const fr of [48, 72]) { const o = a.createOscillator(), og = a.createGain(); o.frequency.value = fr; og.gain.value = fr < 60 ? 0.016 : 0.01; o.connect(og); og.connect(g); o.start(t); o.stop(t + D + 0.05); }
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, (D + 0.3) * 1000);
  }
  function tick_(g, live) {
    if (K.g !== g) { K.g = g; K.splash.length = 0; K.boltT = -999; K.nextBolt = tick + 300 + Math.random() * 300; K.fishT = -9999; K.nextFish = tick + 240; K.clawT = -9999; K.rumble = 0; }
    if (tick >= K.nextBolt) {
      K.boltT = tick; K.nextBolt = tick + 600 + Math.random() * 360;
      K.bolt = [0.78 + Math.random() * 0.14, Math.random() - 0.3, Math.random(), Math.random() - 0.5];
      K.rumble = tick + 36;
    }
    if (tick >= K.nextFish) { K.fishT = tick; K.nextFish = tick + 840; K.fishX = 0.35 + Math.random() * 0.3; }
    if (tick % 300 === 120) K.clawT = tick;
    if (!live || !Sfx.ok()) return;
    const a = Sfx.ctx, t = a.currentTime, b = g.fighters.find((f) => f.spec.boss);
    if (tick === K.rumble) Sfx.noise(0.7, 0.05, 80);
    if (t >= amb.wave) { amb.wave = t + 6; wash(a, t); }
    if (t >= amb.bell) { if (amb.bell) { Sfx.tone(1400, 1380, 0.5, "sine", 0.02); Sfx.tone(2800, 2760, 0.3, "sine", 0.006); } amb.bell = t + 7; }
    if (t >= amb.creak) { if (amb.creak) Sfx.tone(180, 170, 0.06, "sawtooth", 0.01); amb.creak = t + 4; }
    if (b) {
      if (t >= amb.bed) { amb.bed = t + 1; drone(a, t); }
      if (t >= amb.pop) { if (amb.pop && b.x > STAGE.main.x2) Sfx.tone(380 + Math.random() * 160, 150, 0.06, "sine", 0.025); amb.pop = t + 0.8 + Math.random() * 1.4; }
    } else if (t >= amb.horn) { if (amb.horn) foghorn(a, t); amb.horn = t + 25; }
  }

  return { name: "The Deep", bg, stage, tick: tick_, ko };
})();
