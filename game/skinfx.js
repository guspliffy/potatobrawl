/* ===================== skin effects =====================
   Each fighter's four skins add effects step by step (free, 60, 120, 200 chips): 60 adds a small
   effect around the fighter, 120 adds one tied to a move, 200 adds a change on the figure itself
   and a KO effect. The rules: effects are decoration only and never
   change a fighter's size or an attack's size or timing; they avoid the colours the game uses as
   signals (white hit flash, blue invincibility glow, gold armour ring); they stay close to the
   fighter; and they are the first thing dropped when a phone can't keep up. Both players' skins
   are part of the online match setup, so both screens show the same effects. */
const FXTEXT = {
  phoenix: ["", "Embers drift off the wings", "Embers, plus a flame ring on every air jump", "Embers, flame rings, wings that flicker like fire and a flare on every KO"],
  alchemist: ["", "Green drips from the hood", "Drips, plus a vapour trail on the toxic orb", "Drips, vapour trail, glowing eyes and two-colour zaps"],
  odin: ["", "Feathers drift when the raven comes back", "Feathers, plus frosty breath", "Feathers, frosty breath, glowing runes on the armour and a rune ring on every KO"],
  wizard: ["", "Sparkles circle the staff tip", "Sparkles, plus a glitter trail on the bolt", "Sparkles, glitter, twinkling stars on the hat and a star trail on every KO"],
  samurai: ["", "Petals drift while running", "Petals, plus ink-brush slashes", "Petals, ink slashes, a glowing blade and a flash line on Quick Draw"],
  dragon: ["", "Smoke curls from his mouth", "Smoke, plus a gust ring on every wing flap", "Smoke, gusts, glowing wing bones and a fire roar on every KO"],
  gunslinger: ["", "Smoke curls from the barrels", "Smoke, plus brass shells on every Twin Shot", "Smoke, shells, gold pistols and a gold burst on every KO"],
  reaper: ["", "Dark wisps drift off the hood", "Wisps, plus amber soul sparks on every scythe swing", "Wisps, soul sparks, a ghost-lit blade and a soul burst on every KO"],
};
// a Road skin (palettes 4-6, pal.road = the boss that gives it) has none of the chip skins' effects: its own overlay (skinRoad)
const skinLvl = (f) => { const i = f.spec.palettes.indexOf(f.pal); return i < 0 || f.pal.road ? 0 : i; };
const skinRoad = (f) => (f.pal && f.pal.road) || "";
// what each Road skin does (the select screen's note)
const ROADFX = { scratch: "", zorp: "", kraken: "" };
const fxAmbient = () => true; // 60-chip effects would go first on slow phones (only the old 3D mode ever dropped them; always on now)
const fxMoves = () => true;   // then the 120-chip ones; KO effects always stay
const skinState = [0, 1, 2].map(() => ({ flare: 0, raven: false, dashX: null }));   // one per slot (a boss fight has three)
const rnd = (a, b) => a + Math.random() * (b - a);
function mote(x, y, vx, vy, col, r, life, grav) { addFx({ k: "mote", x, y, vx, vy, col, r, t: 0, life, g: grav || 0, damp: 0.95 }); }
function staffTip(f, tk) {
  const P = pose(f, tk), shR = rot(P.sh, P.hip, P.lean), a = heldDir(f, P, shR, -Math.PI / 2 + 0.12);
  return [f.x + (P.hF[0] + Math.cos(a) * 40) * f.facing, f.y + P.hF[1] + Math.sin(a) * 40];
}

function skinTick(g, tk) {
  g.fighters.forEach((f, slot) => {
    const S = skinState[slot];
    if (S.flare > 0) S.flare--;
    const alive = f.state !== "dead" && f.state !== "gone";
    const lvl = skinLvl(f), cos = f.spec.look.costume, w = f.s.w, h = f.s.h, fc = f.facing, ac = f.pal.accent;
    const ravenOut = g.projs.some((p) => p.owner === slot && p.style === "raven");
    // Odin 60: feathers when the raven lands back on his shoulder
    if (cos === "odin" && lvl >= 1 && S.raven && !ravenOut && alive && fxAmbient()) {
      for (let i = 0; i < 4; i++) addFx({ k: "feather", x: f.x - fc * w * 0.35 + rnd(-7, 7), y: f.y - h * 0.85, vx: rnd(-0.8, 0.8), vy: rnd(-1.4, -0.5), rot: rnd(0, 6), vr: rnd(-0.12, 0.12), t: 0, life: rnd(50, 70), g: 0.05, damp: 0.95 });
    }
    S.raven = ravenOut;
    if (!alive || lvl < 1) return;
    if (fxAmbient()) {
      if (cos === "phoenix" && !f.grounded && f.state !== "ledge" && tk % 3 === 0) {
        const side = Math.random() < 0.5 ? -1 : 1;
        mote(f.x + side * w * rnd(0.6, 1.1), f.y - h * rnd(0.55, 0.95), rnd(-0.4, 0.4) + side * 0.3, rnd(-1.2, -0.4), Math.random() < 0.5 ? ac : mix(ac, "#ffd27a", 0.6), rnd(1.4, 2.4), rnd(16, 26), -0.02);
      }
      if (cos === "alchemist" && tk % 9 === 0) {
        addFx({ k: "drip", x: f.x + rnd(-0.42, 0.42) * w, y: f.y - h * 0.32, vx: 0, vy: 0.4, col: mix(ac, "#7dff62", 0.65), r: rnd(1.6, 2.3), t: 0, life: 26, g: 0.22, damp: 0.98 });
      }
      if (cos === "wizard" && tk % 4 === 0) {
        const [tx, ty] = staffTip(f, tk), a = tk * 0.21;
        mote(tx + Math.cos(a) * 11, ty + Math.sin(a) * 7, -Math.sin(a) * 0.5, Math.cos(a) * 0.35 - 0.15, Math.random() < 0.5 ? "#ffd98a" : mix(ac, "#ffd98a", 0.5), rnd(1.1, 1.8), 20);
      }
      if (cos === "dragon" && tk % 36 === (slot * 13) % 36 && f.state !== "attack") {
        for (let i = 0; i < 2; i++) addFx({ k: "puff", x: f.x + fc * w * (0.34 + i * 0.08), y: f.y - h * 0.5 - i * 2, vx: fc * rnd(0.1, 0.4), vy: rnd(-0.7, -0.4), r: rnd(2.2, 3.2), t: 0, life: 30, col: "#9d98aa" });
      }
      if (cos === "gunslinger" && f.state === "idle" && tk % 14 === (slot * 5) % 14) {
        addFx({ k: "puff", x: f.x + fc * w * rnd(0.95, 1.1), y: f.y - h * 0.58 + rnd(-2, 2), vx: fc * rnd(0, 0.3), vy: rnd(-0.6, -0.35), r: rnd(1.6, 2.4), t: 0, life: 34, col: "#cfc8d8" });
      }
      if (cos === "reaper" && tk % 11 === (slot * 4) % 11 && f.state !== "attack") {   // a wisp slips off the back of the hood and drifts up
        addFx({ k: "wisp", x: f.x - fc * w * rnd(0.45, 0.65), y: f.y - h * rnd(0.45, 0.7), vx: -fc * rnd(0.1, 0.4), vy: rnd(-0.7, -0.35), r: rnd(2.6, 3.6), t: 0, life: rnd(34, 46), col: lvl >= 3 ? "#d8d2c4" : "#3f3a4c", ph: rnd(0, 6) });
      }
      if (cos === "samurai" && f.state === "run" && tk % 5 === 0) {
        addFx({ k: "petal", x: f.x - fc * w * 0.3 + rnd(-6, 6), y: f.y - h * rnd(0.4, 0.75), vx: -fc * rnd(0.6, 1.4), vy: rnd(-1, -0.2), rot: rnd(0, 6), vr: rnd(-0.15, 0.15), col: mix(ac, "#ffb7c9", 0.6), r: rnd(2.2, 3), t: 0, life: rnd(34, 48), g: 0.035, damp: 0.97 });
      }
    }
    if (lvl >= 2 && fxMoves()) {
      if (cos === "odin" && f.state === "idle" && tk % 50 === slot * 7) {
        for (let i = 0; i < 3; i++) addFx({ k: "puff", x: f.x + fc * (w * 0.3 + i * 4), y: f.y - h * 0.5 - i, vx: fc * rnd(0.5, 1.1), vy: rnd(-0.3, 0.1), r: rnd(2, 3.2), t: 0, life: 26, col: "#dfe6ec" });
      }
      for (const p of g.projs) {
        if (p.owner !== slot) continue;
        if (p.style === "orb" && tk % 2 === 0) addFx({ k: "puff", x: p.x - p.vx * 1.5 + rnd(-3, 3), y: p.y - p.vy * 1.5 + rnd(-3, 3), vx: 0, vy: -0.25, r: rnd(3, 5), t: 0, life: 22, col: mix(ac, "#7dff62", 0.5) });
        if (p.style === "bolt") mote(p.x - p.vx * rnd(0.5, 1.5), p.y + rnd(-4, 4), -p.vx * 0.05, rnd(-0.5, 0.5), Math.random() < 0.5 ? "#ffe08a" : mix(ac, "#ffe08a", 0.4), rnd(1, 1.7), 16);
      }
    }
    // Reaper 120: candle-amber soul sparks fly off the scythe's hitboxes while it swings
    if (lvl >= 2 && cos === "reaper" && fxMoves() && f.state === "attack" && f.move && f.move.scythe && tk % 2 === 0) {
      const bx = BL.activeBoxes(f);
      if (bx) for (const b of bx) mote(b.x + rnd(-0.5, 0.5) * b.r, b.y + rnd(-0.5, 0.5) * b.r, rnd(-1, 1), rnd(-1.6, -0.6), Math.random() < 0.5 ? "#ffb35c" : "#ffd9a0", rnd(1.2, 2), rnd(18, 26), -0.02);
    }
    // Samurai 200: a flash line along the Quick Draw path
    if (lvl >= 3 && cos === "samurai" && f.state === "attack" && f.move && f.move.kind === "dash") {
      const m = f.move, a0 = m.startup + 1, a1 = m.startup + m.active;
      if (f.mt === a0) S.dashX = f.x;
      if (f.mt === a1 && S.dashX !== null) { addFx({ k: "flashline", x1: S.dashX, x2: f.x, y: f.y - h * 0.45, col: ac, t: 0, life: 22 }); S.dashX = null; }
    }
  });
}

function skinEvent(g, e) {
  const at = (slot) => g.fighters[slot];
  switch (e.type) {
    case "jump": {
      const f = at(e.slot);
      if (f && !e.ground && f.spec.look.costume === "dragon" && skinLvl(f) >= 2 && fxMoves()) {
        addFx({ k: "ring", x: e.x, y: e.y - 10, t: 0, life: 14, r0: 10, r1: 40, col: mix(f.pal.accent, "#e8e2f0", 0.4) });
        for (let i = 0; i < 4; i++) addFx({ k: "puff", x: e.x + rnd(-14, 14), y: e.y - 6, vx: rnd(-1.5, 1.5), vy: rnd(0.3, 1), r: rnd(3, 4.5), t: 0, life: 18, col: mix(f.pal.accent, "#d9d4ea", 0.5) });
        return;
      }
      if (!f || e.ground || f.spec.look.costume !== "phoenix" || skinLvl(f) < 2 || !fxMoves()) return;
      addFx({ k: "ring", x: e.x, y: e.y - 6, t: 0, life: 14, r0: 8, r1: 30, col: f.pal.accent });
      for (let i = 0; i < 5; i++) mote(e.x + rnd(-10, 10), e.y - 4, rnd(-1.2, 1.2), rnd(0.4, 1.4), mix(f.pal.accent, "#ffd27a", 0.5), rnd(1.3, 2), 16);
      return;
    }
    case "proj": {
      const f = at(e.slot);
      if (!f || f.spec.look.costume !== "gunslinger" || skinLvl(f) < 2 || !fxMoves()) return;
      addFx({ k: "shard", x: f.x + f.facing * 26, y: f.y - f.s.h * 0.62, vx: -f.facing * rnd(1, 2.4), vy: rnd(-3.4, -2.2), rot: rnd(0, 6), vr: rnd(-0.4, 0.4), r: 2.2, col: "#e3b54a", t: 0, life: 30, g: 0.32, damp: 0.98 });
      return;
    }
    case "burst": {
      const f = at(e.slot);
      if (!f || skinLvl(f) < 2 || !fxMoves()) return;
      for (let i = 0; i < 8; i++) addFx({ k: "puff", x: e.x + rnd(-e.r, e.r) * 0.6, y: e.y + rnd(-e.r, e.r) * 0.4, vx: rnd(-1, 1), vy: rnd(-1.2, -0.2), r: rnd(4, 7), t: 0, life: 24, col: mix(f.pal.accent, "#7dff62", 0.45) });
      return;
    }
    case "projEnd": case "hit": {
      const style = e.type === "hit" ? e.ps : e.style, f = at(e.slot);
      if (style !== "bolt" || !f || skinLvl(f) < 2 || !fxMoves()) return;
      for (let i = 0; i < 7; i++) addFx({ k: "shard", x: e.x, y: e.y, vx: rnd(-3.5, 3.5), vy: rnd(-3.5, 1), rot: rnd(0, 6), vr: rnd(-0.3, 0.3), r: rnd(2, 3.4), col: i % 2 ? "#ffe08a" : mix(f.pal.accent, "#ffe08a", 0.4), t: 0, life: 20, g: 0.15, damp: 0.93 });
      return;
    }
    case "ko": {
      if (e.sd) return;
      const k = at(foeSlot(e.slot, g));
      if (!k || skinLvl(k) < 3 || k.state === "dead" || k.state === "gone") return;
      const cos = k.spec.look.costume, ac = k.pal.accent;
      if (cos === "phoenix") {
        skinState[k.slot].flare = 45;
        for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; mote(k.x + Math.cos(a) * 18, k.y - k.s.h * 0.6 + Math.sin(a) * 18, Math.cos(a) * 1.6, Math.sin(a) * 1.6 - 0.6, i % 2 ? ac : mix(ac, "#ffd27a", 0.6), rnd(1.6, 2.6), 26); }
      } else if (cos === "dragon") {
        const mx = k.x + k.facing * k.s.w * 0.35, my = k.y - k.s.h * 0.5;
        addFx({ k: "ring", x: mx, y: my, t: 0, life: 16, r0: 6, r1: 36, col: "#ff8a3d" });
        for (let i = 0; i < 16; i++) ember(mx, my, k.facing * rnd(1.5, 5) , rnd(-2.5, 1.5));
      } else if (cos === "gunslinger") {
        addFx({ k: "ring", x: k.x, y: k.y - k.s.h * 0.6, t: 0, life: 18, r0: 8, r1: 46, col: mix(ac, "#ffcf3d", 0.6) });
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; mote(k.x + Math.cos(a) * 14, k.y - k.s.h * 0.6 + Math.sin(a) * 14, Math.cos(a) * 1.8, Math.sin(a) * 1.8 - 0.4, i % 2 ? "#ffcf3d" : "#fff4c8", rnd(1.4, 2.2), 26); }
      } else if (cos === "reaper") {   // a ring of pale light and three little souls rising off him
        addFx({ k: "ring", x: k.x, y: k.y - k.s.h * 0.6, t: 0, life: 18, r0: 8, r1: 44, col: "#c8ffe0" });
        for (let i = 0; i < 3; i++) addFx({ k: "ghost", x: k.x + (i - 1) * 16, y: k.y - k.s.h * (0.7 + (i % 2) * 0.15), vx: (i - 1) * 0.4, vy: rnd(-1.2, -0.8), r: rnd(6, 8), t: 0, life: rnd(50, 64), ph: i * 2, damp: 0.99 });
      } else if (cos === "odin") {
        addFx({ k: "runering", x: k.x, y: k.y, col: mix(ac, "#ffb347", 0.35), t: 0, life: 60, r: k.s.w * 1.1 });
      } else if (cos === "wizard") {
        const tr = trails[e.slot], pts = [];
        const src = tr.length >= 3 ? tr : [[g.fighters[e.slot].x, g.fighters[e.slot].y - 30], [e.x, e.y]];
        for (let i = 0; i < 7; i++) {
          const q = (i / 6) * (src.length - 1), j = Math.floor(q), u = q - j, A = src[j], B = src[Math.min(src.length - 1, j + 1)];
          pts.push([A[0] + (B[0] - A[0]) * u + rnd(-14, 14), A[1] + (B[1] - A[1]) * u + rnd(-14, 14), rnd(1.4, 2.6)]);
        }
        addFx({ k: "constellation", pts, col: mix(ac, "#ffd98a", 0.55), t: 0, life: 90, x: 0, y: 0 });
      }
      return;
    }
  }
}

// Draws the skin-effect particle kinds; returns false for kinds it doesn't own.
function drawSkinFx(c, e, a) {
  switch (e.k) {
    case "mote":
      c.globalAlpha = a * 0.35; c.fillStyle = e.col; c.beginPath(); c.arc(e.x, e.y, e.r * 2.3, 0, Math.PI * 2); c.fill();
      c.globalAlpha = a; c.beginPath(); c.arc(e.x, e.y, e.r, 0, Math.PI * 2); c.fill();
      return true;
    case "drip":
      c.globalAlpha = a; c.fillStyle = e.col; c.beginPath(); c.ellipse(e.x, e.y, e.r * 0.75, e.r * 1.25, 0, 0, Math.PI * 2); c.fill();
      return true;
    case "petal":
      c.save(); c.translate(e.x, e.y); c.rotate(e.rot); c.globalAlpha = a; c.fillStyle = e.col;
      c.beginPath(); c.ellipse(0, 0, e.r, e.r * 0.55, 0, 0, Math.PI * 2); c.fill(); c.restore();
      return true;
    case "feather":
      c.save(); c.translate(e.x, e.y); c.rotate(e.rot); c.globalAlpha = a;
      c.fillStyle = "#24232c"; c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(0, -3.2, 6, 0); c.quadraticCurveTo(0, 3.2, -6, 0); c.fill();
      c.strokeStyle = "#4a4858"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.stroke(); c.restore();
      return true;
    case "shard":
      c.save(); c.translate(e.x, e.y); c.rotate(e.rot); c.globalAlpha = a; c.fillStyle = e.col;
      c.beginPath(); c.moveTo(0, -e.r * 1.3); c.lineTo(e.r * 0.7, e.r * 0.6); c.lineTo(-e.r * 0.7, e.r * 0.6); c.closePath(); c.fill(); c.restore();
      return true;
    case "runering": {
      const q = e.t / e.life, r = e.r * (0.7 + 0.5 * ease(Math.min(1, q * 2)));
      c.globalAlpha = a * 0.9; c.strokeStyle = e.col; c.lineWidth = 2.2;
      c.beginPath(); c.ellipse(e.x, e.y, r, r * 0.26, 0, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 1.6;
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2 + q * 1.5, x = e.x + Math.cos(ang) * r, y = e.y + Math.sin(ang) * r * 0.26;
        c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x, y + 2); c.moveTo(x - 2, y - 2); c.lineTo(x + 2, y - 4); c.stroke();
      }
      return true;
    }
    case "wisp": {   // a soft smoky curl that sways as it rises
      const q = e.t / e.life, sx = Math.sin(e.t * 0.18 + e.ph) * 2.5;
      c.globalAlpha = a * 0.45; c.fillStyle = e.col;
      c.beginPath(); c.arc(e.x + sx, e.y, e.r * (1 + q * 0.8), 0, Math.PI * 2); c.fill();
      c.globalAlpha = a * 0.3; c.beginPath(); c.arc(e.x - sx * 0.6, e.y + e.r * 1.4, e.r * 0.7 * (1 + q), 0, Math.PI * 2); c.fill();
      return true;
    }
    case "ghost": {   // a little soul: a round head, a wavy tail, two dot eyes
      const sx = Math.sin(e.t * 0.15 + e.ph) * 3, x = e.x + sx, y = e.y, r = e.r;
      c.globalAlpha = a * 0.85; c.fillStyle = "#eefff4";
      c.beginPath(); c.arc(x, y, r, Math.PI, 0); c.lineTo(x + r, y + r * 1.2);
      for (let i = 0; i < 3; i++) { const xx = x + r - (i + 0.5) * (2 * r / 3); c.quadraticCurveTo(xx + r / 3, y + r * (i % 2 ? 1.0 : 1.6), xx - r / 3 + 0.01, y + r * 1.2); }
      c.closePath(); c.fill();
      c.globalAlpha = a * 0.35; c.strokeStyle = "#8fe8b8"; c.lineWidth = 2; c.stroke();
      c.globalAlpha = a; c.fillStyle = "#2a2a3a"; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.05, r * 0.16, 0, Math.PI * 2); c.arc(x + r * 0.35, y - r * 0.05, r * 0.16, 0, Math.PI * 2); c.fill();
      return true;
    }
    case "flashline": {
      const q = e.t / e.life;
      c.globalAlpha = a * 0.35; c.strokeStyle = e.col; c.lineCap = "round"; c.lineWidth = 9 * (1 - q) + 2;
      c.beginPath(); c.moveTo(e.x1, e.y); c.lineTo(e.x2, e.y); c.stroke();
      c.globalAlpha = a; c.lineWidth = 2.5 * (1 - q) + 0.8; c.strokeStyle = mix(e.col, "#fff6e0", 0.5);
      c.beginPath(); c.moveTo(e.x1, e.y); c.lineTo(e.x2, e.y); c.stroke();
      return true;
    }
    case "constellation": {
      const reveal = Math.min(1, e.t / 18), n = Math.max(1, Math.round(e.pts.length * reveal));
      c.globalAlpha = a * 0.55; c.strokeStyle = e.col; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(e.pts[0][0], e.pts[0][1]); for (let i = 1; i < n; i++) c.lineTo(e.pts[i][0], e.pts[i][1]); c.stroke();
      c.fillStyle = e.col;
      for (let i = 0; i < n; i++) { const p = e.pts[i], tw = 0.7 + 0.3 * Math.sin(e.t * 0.3 + i * 2); c.globalAlpha = a * tw; c.beginPath(); c.arc(p[0], p[1], p[2], 0, Math.PI * 2); c.fill(); }
      return true;
    }
  }
  return false;
}
