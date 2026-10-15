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
const ROADFX = { scratch: "Roasted dark at the feet, with ember cracks that glow and spit sparks",
  zorp: "A glass specimen dome over the head and a green glow from below", kraken: "A wet sheen, barnacles, a starfish and a strand of kelp" };
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
    const rs = skinRoad(f);
    if (rs) { if (alive && fxAmbient()) roadSkinTick(f, rs, tk, slot); return; }
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
      if (k && skinRoad(k) && k.state !== "dead" && k.state !== "gone") return roadSkinKo(k, skinRoad(k));
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

/* ---- Road skins: one overlay per boss, laid on any fighter in two passes (UI only) ----
   roadSkinBody runs inside the body's lean, clipped to the potato, before the face (so it lies on the body and the costume's
   clothes); roadSkinTop runs after the hats, hoods, horns and crests. No white fills, blue glows or gold rings: the glows are
   ember orange, alien green and sea teal. Nothing is drawn on a hit flash. */
const RS_CRACK = [[-0.62, 0.12, 0, [[0, 0], [3, -2], [5, 1.5], [8, -0.5], [10, 2.5]]], [-0.1, 0.42, 2.1, [[0, 0], [2.5, 2.5], [6, 2], [8, 5], [11, 4.5]]], [0.42, 0.06, 4.2, [[0, 0], [-2, 3], [1, 5.5], [-0.5, 8.5], [2, 11]]]];
const RS_PATCH = [[-0.86, -0.2, 0.5], [0.72, 0.5, -0.4]];
const RS_BARN = [[-0.78, 0.22, 1], [-0.62, 0.5, 0.85], [-0.86, 0.48, 0.7], [-0.45, 0.72, 0.8], [-0.7, 0.74, 0.6]];
// the Specimen dome per costume: half width (x rx) and how far above the top of the potato it reaches (x ry); the Gunslinger's brim fits under the glass
const RS_DOME = { phoenix: [1.2, 0.95], alchemist: [1.25, 0.7], odin: [1.35, 0.5], wizard: [1.25, 1.75], samurai: [1.2, 0.6], dragon: [1.25, 0.85], gunslinger: [1.6, 0.75], reaper: [1.3, 0.55] };
// where the Deep Catch kelp hangs from: the back of the costume's top point (x rx, y below the top of the potato x ry)
const RS_KELP = { phoenix: [-0.3, -0.5], alchemist: [-0.75, 0.05], odin: [-0.9, -0.1], wizard: [-0.95, -1.2], samurai: [-0.25, -0.15], dragon: [-0.45, -0.45], gunslinger: [-1.35, -0.05], reaper: [-0.95, 0.2] };
const rsPulse = (tk, ph) => 0.8 + 0.2 * Math.sin(tk * 0.044 + ph);
function rsStar(c, x, y, r, a) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const q = a + (i / 10) * Math.PI * 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(q) * rr, y + Math.sin(q) * rr); }
  c.closePath();
}
function roadSkinBody(c, f, P, tk, flash) {
  const rs = skinRoad(f);
  if (!rs || flash) return;
  const { rx, ry, cy } = P, k = rx / 25;
  c.save(); potatoPath(c, P); c.clip();
  if (P.dim) c.globalAlpha = 0.5;
  const a0 = c.globalAlpha;
  if (rs === "scratch") {
    const g = c.createRadialGradient(0, cy + ry * 1.1, ry * 0.15, 0, cy + ry * 1.1, ry * 1.2);
    g.addColorStop(0, "rgba(60,25,15,0.6)"); g.addColorStop(1, "rgba(60,25,15,0)");
    c.fillStyle = g; c.fillRect(-rx * 1.3, cy - ry * 0.2, rx * 2.6, ry * 1.4);
    c.fillStyle = "#3a1a14"; c.strokeStyle = OUT; c.lineWidth = 1;
    for (const [x, y, a] of RS_PATCH) { c.beginPath(); c.ellipse(x * rx, cy + y * ry, 5 * k, 3.5 * k, a, 0, Math.PI * 2); c.fill(); c.stroke(); }
    c.lineJoin = "miter";
    for (const [x, y, ph, pts] of RS_CRACK) {
      const p = rsPulse(tk, ph), x0 = x * rx, y0 = cy + y * ry;
      c.beginPath(); c.moveTo(x0, y0);
      for (let i = 1; i < pts.length; i++) c.lineTo(x0 + pts[i][0] * k, y0 + pts[i][1] * k);
      c.globalAlpha = a0 * p; c.strokeStyle = "rgba(255,122,43,0.5)"; c.lineWidth = 5 * k; c.stroke();
      c.strokeStyle = "#ff9a3a"; c.lineWidth = 2 * k; c.stroke();
    }
    c.lineJoin = "round";
  } else if (rs === "zorp") {
    const g = c.createRadialGradient(0, cy + ry * 1.15, ry * 0.1, 0, cy + ry * 1.15, ry * 1.25);
    g.addColorStop(0, "rgba(157,255,90,0.38)"); g.addColorStop(1, "rgba(157,255,90,0)");
    c.fillStyle = g; c.fillRect(-rx * 1.3, cy - ry * 0.2, rx * 2.6, ry * 1.4);
  } else if (rs === "kraken") {
    c.strokeStyle = "rgba(200,240,255,0.3)"; c.lineWidth = 3 * k;
    c.beginPath(); c.ellipse(0, cy, rx * 0.78, ry * 0.8, 0, Math.PI * 1.08, Math.PI * 1.42); c.stroke();
    c.lineWidth = 1.6 * k; c.beginPath(); c.ellipse(0, cy, rx * 0.66, ry * 0.68, 0, Math.PI * 1.12, Math.PI * 1.25); c.stroke();
    c.lineWidth = 1;
    for (const [x, y, s] of RS_BARN) {
      const bx = x * rx, by = cy + y * ry, r = 3 * k * s;
      c.fillStyle = "#d9d2c0"; c.strokeStyle = OUT; c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = "#3a3a3a"; c.beginPath(); c.arc(bx, by - r * 0.1, r * 0.42, 0, Math.PI * 2); c.fill();
    }
    rsStar(c, rx * 0.5, cy + ry * 0.55, 5 * k, -0.3 + Math.sin(tk * 0.03) * 0.05);
    c.fillStyle = "#ff8fb0"; c.fill(); c.strokeStyle = OUT; c.stroke();
    c.fillStyle = "#ffc2d4"; for (let i = 0; i < 5; i++) { const q = -0.3 + (i / 5) * Math.PI * 2; c.beginPath(); c.arc(rx * 0.5 + Math.cos(q) * 2.6 * k, cy + ry * 0.55 + Math.sin(q) * 2.6 * k, 0.6 * k, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
}
function roadSkinTop(c, f, P, tk, flash) {
  const rs = skinRoad(f);
  if (!rs || flash) return;
  const { rx, ry, cy } = P, cos = f.spec.look.costume, k = rx / 25;
  c.save();
  if (P.dim) c.globalAlpha = 0.5;
  if (rs === "zorp") {
    const [hw, up] = RS_DOME[cos] || [1.25, 0.7], dw = rx * hw, base = cy + ry * 0.3, dh = base - (P.top - ry * up);
    c.beginPath(); c.ellipse(0, base, dw, dh, 0, Math.PI, Math.PI * 2); c.closePath();
    c.fillStyle = "rgba(170,235,255,0.14)"; c.fill();
    c.globalAlpha *= 0.55; c.strokeStyle = "#9dff5a"; c.lineWidth = 3; c.stroke(); c.globalAlpha /= 0.55;
    c.globalAlpha *= 0.7; c.strokeStyle = "#d8f3ff"; c.lineWidth = 1.4;
    c.beginPath(); c.ellipse(0, base, dw - 2, dh - 2, 0, Math.PI, Math.PI * 2); c.stroke(); c.globalAlpha /= 0.7;
    c.strokeStyle = "rgba(230,255,245,0.45)"; c.lineWidth = 2.4;
    c.beginPath(); c.ellipse(0, base, dw * 0.78, dh * 0.84, 0, Math.PI * 1.17, Math.PI * 1.38); c.stroke();
    // the orbiting motes inside the glass
    c.fillStyle = "#9dff5a";
    for (let i = 0; i < 3; i++) { const a = tk * 0.0524 + i * 2.094; c.beginPath(); c.arc(Math.cos(a) * dw * 0.72, base - dh * 0.55 + Math.sin(a) * dh * 0.3, 1.1 * k, 0, Math.PI * 2); c.fill(); }
    // the collar: a steel band with two green lights
    c.fillStyle = "#7f8b93"; c.strokeStyle = OUT; c.lineWidth = 1;
    c.beginPath(); c.rect(-dw - 1.5, base - 1.5, dw * 2 + 3, 3.2); c.fill(); c.stroke();
    const on = (tk >> 4) % 4;
    for (const [i, sx] of [[0, -0.55], [2, 0.55]]) { c.fillStyle = on === i || on === i + 1 ? "#9dff5a" : "#4f8a3a"; c.beginPath(); c.arc(sx * dw, base + 0.1, 1.3, 0, Math.PI * 2); c.fill(); }
  } else if (rs === "kraken") {
    // a wavy strand of kelp hanging down the back from the costume's top point, the wave running down it, two blades off it
    const [ax, ay] = RS_KELP[cos] || [-0.8, 0], x0 = ax * rx, y0 = P.top + ay * ry, L = 30 * k, ph = tk * 0.09 + f.slot, sw = Math.sin(tk * 0.052 + f.slot) * 0.2;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, dx = -t * L * 0.22 + Math.sin(t * 6 - ph) * 3 * k * t, dy = t * L;
      pts.push([x0 + dx * Math.cos(sw) - dy * Math.sin(sw), y0 + dx * Math.sin(sw) + dy * Math.cos(sw)]);
    }
    const line = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); };
    c.lineCap = "round"; c.lineJoin = "round";
    c.fillStyle = "#2f8a5a"; c.strokeStyle = OUT; c.lineWidth = 1;
    for (const [i, s2] of [[4, -1], [7, 1]]) {
      const [bx, by] = pts[i];
      c.beginPath(); c.ellipse(bx + s2 * 3.2 * k, by + 1.5 * k, 4.6 * k, 1.7 * k, s2 * 0.7 + sw + Math.sin(ph + i) * 0.15, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    line(); c.strokeStyle = OUT; c.lineWidth = 5.4 * k; c.stroke();
    c.strokeStyle = "#2f8a5a"; c.lineWidth = 3.6 * k; c.stroke();
    c.strokeStyle = "#5fbf7f"; c.lineWidth = 1.1 * k; c.beginPath(); c.moveTo(pts[1][0], pts[1][1]); for (let i = 2; i < 9; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    c.fillStyle = "#246e48"; c.beginPath(); c.arc(x0, y0, 2.2 * k, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
// ambient bits that leave the figure (particles): an ember spat off a crack, a drip off the kelp
function roadSkinTick(f, rs, tk, slot) {
  const w = f.s.w, h = f.s.h, fc = f.facing;
  if (rs === "scratch" && tk % 30 === (slot * 11) % 30) {
    const [x, y] = RS_CRACK[(tk / 30 | 0) % 3];
    mote(f.x + fc * x * w * 0.56, f.y - h * (0.36 - y * 0.24), rnd(-0.3, 0.3), rnd(-0.9, -0.5), Math.random() < 0.5 ? "#ff9a3a" : "#ff6a2b", 1.5, 40, -0.01);
  }
  if (rs === "kraken" && tk % 40 === (slot * 13) % 40) {
    const [ax] = RS_KELP[f.spec.look.costume] || [-0.8];
    addFx({ k: "drip", x: f.x + fc * (ax * w * 0.56 - 10), y: f.y - h * 0.5, vx: 0, vy: 0.3, col: "#bfe8e0", r: rnd(1.4, 1.9), t: 0, life: 15, g: 0.2, damp: 0.98 });
  }
}
// a Road skin's KO effect, off the fighter who scored it
function roadSkinKo(k, rs) {
  const x = k.x, y = k.y - k.s.h * 0.6;
  if (rs === "scratch") {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; mote(x + Math.cos(a) * 14, y + Math.sin(a) * 14, Math.cos(a) * 1.7, Math.sin(a) * 1.7 - 0.7, i % 2 ? "#ff9a3a" : "#ff6a2b", rnd(1.4, 2.2), 30, -0.02); }
  } else if (rs === "zorp") {
    addFx({ k: "ring", x, y: y - 6, t: 0, life: 16, r0: 10, r1: 44, col: "#9dff5a" });
    for (let i = 0; i < 6; i++) addFx({ k: "shard", x: x + rnd(-12, 12), y: y - 14 + rnd(-6, 6), vx: rnd(-3, 3), vy: rnd(-4, -1.5), rot: rnd(0, 6), vr: rnd(-0.3, 0.3), r: rnd(2.4, 3.4), col: "rgba(216,243,255,0.8)", t: 0, life: 26, g: 0.2, damp: 0.96 });
  } else if (rs === "kraken") {
    addFx({ k: "ring", x, y: k.y - 4, t: 0, life: 18, r0: 8, r1: 46, col: "#3ef2c0" });
    for (let i = 0; i < 3; i++) addFx({ k: "drip", x: x + (i - 1) * 9, y: y + 4, vx: (i - 1) * 1.4, vy: rnd(-3.4, -2.4), col: "#3ef2c0", r: rnd(1.8, 2.4), t: 0, life: 30, g: 0.2, damp: 0.98 });
  }
}
