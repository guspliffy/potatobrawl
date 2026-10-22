/* ===================== skin effects =====================
   Each fighter's four skins add effects step by step (free, 60, 150, 300 chips): 60 adds a small
   effect around the fighter, 150 adds one tied to a move, 300 adds a change on the figure itself
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
// a Road skin (palettes 4-6, pal.road = the boss that gives it), the Harvest skin (palette 7, pal.road = "harvest", ui/harvest.js) and a
// Pommes skin (palettes 8-9, pal.pommes = the line) have none of the chip skins' effects: their own overlay (skinRoad, skinPm)
const skinLvl = (f) => { const i = f.spec.palettes.indexOf(f.pal); return i < 0 || f.pal.road || f.pal.pommes ? 0 : i; };
const skinRoad = (f) => (f.pal && f.pal.road) || "";
// what each Road skin does (the select screen's note)
const ROADFX = { scratch: "Roasted dark at the feet, with ember cracks that glow and spit sparks",
  zorp: "A glass specimen dome over the head and a green glow from below", kraken: "A wet sheen, barnacles, a starfish and a strand of kelp",
  harvest: "A sun-warmed sheen with twinkling gold dust that drifts off and bursts on every KO" };
const fxAmbient = () => true; // 60-chip effects would go first on slow phones (only the old 3D mode ever dropped them; always on now)
const fxMoves = () => true;   // then the 120-chip ones; KO effects always stay
const skinState = [0, 1, 2, 3].map(() => ({ flare: 0, raven: false, dashX: null }));   // one per slot (a boss fight has three, a 2v2 four)
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
    const rs = skinRoad(f), pm = skinPm(f);
    if (rs) { if (alive && fxAmbient()) roadSkinTick(f, rs, tk, slot); return; }
    if (pm) { if (alive && fxAmbient()) pmskTick(f, pm, tk, slot); return; }
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
      if (e.type === "hit" && f && skinPm(f) === 1 && fxMoves()) pmskHit(f, e);   // Ink Noir: an ink star on every landed hit
      if (style !== "bolt" || !f || skinLvl(f) < 2 || !fxMoves()) return;
      for (let i = 0; i < 7; i++) addFx({ k: "shard", x: e.x, y: e.y, vx: rnd(-3.5, 3.5), vy: rnd(-3.5, 1), rot: rnd(0, 6), vr: rnd(-0.3, 0.3), r: rnd(2, 3.4), col: i % 2 ? "#ffe08a" : mix(f.pal.accent, "#ffe08a", 0.4), t: 0, life: 20, g: 0.15, damp: 0.93 });
      return;
    }
    case "ko": {
      if (e.sd) return;
      const k = at(foeSlot(e.slot, g));
      if (k && skinRoad(k) && k.state !== "dead" && k.state !== "gone") return roadSkinKo(k, skinRoad(k));
      if (k && skinPm(k) && k.state !== "dead" && k.state !== "gone") return pmskKo(k, skinPm(k));
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
  return pmskDrawFx(c, e, a);   // the Pommes skins' kinds (below)
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
// the Harvest skin's gold dust on the body: x, y (of the half-sizes), size, phase
const RS_DUST = [[-0.55, -0.35, 1, 0], [0.38, -0.55, 0.8, 1.7], [0.62, 0.12, 1.1, 3.1], [-0.3, 0.35, 0.75, 4.4], [0.1, 0.62, 0.9, 5.6]];
function rsStar(c, x, y, r, a) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const q = a + (i / 10) * Math.PI * 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(q) * rr, y + Math.sin(q) * rr); }
  c.closePath();
}
function roadSkinBody(c, f, P, tk, flash) {
  if (skinPm(f)) { if (!flash) pmskPass(pmskBody, c, f, P, tk); return; }   // a Pommes skin's body pass (below)
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
  } else if (rs === "harvest") {   // late sun from the upper left, and specks of gold dust that twinkle in turn
    const g = c.createRadialGradient(-rx * 0.45, cy - ry * 0.6, ry * 0.1, -rx * 0.45, cy - ry * 0.6, ry * 1.5);
    g.addColorStop(0, "rgba(255,230,150,0.42)"); g.addColorStop(1, "rgba(255,230,150,0)");
    c.fillStyle = g; c.fillRect(-rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6);
    for (const [x, y, s, ph] of RS_DUST) {
      const tw = Math.max(0, Math.sin(tk * 0.06 + ph)), r = (1.2 + 1.6 * tw) * k * s;
      c.globalAlpha = a0 * (0.45 + 0.55 * tw);
      rsStar(c, x * rx, cy + y * ry, r, tk * 0.01 + ph); c.fillStyle = "#ffe08a"; c.fill();
    }
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
  if (skinPm(f)) { if (!flash) pmskPass(pmskTop, c, f, P, tk); return; }   // a Pommes skin's top pass (below)
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
  if (rs === "harvest" && tk % 14 === (slot * 5) % 14) {   // a fleck of gold dust lifts off and sinks away
    mote(f.x + rnd(-0.5, 0.5) * w, f.y - h * rnd(0.3, 0.85), rnd(-0.25, 0.25), rnd(-0.6, -0.2), Math.random() < 0.6 ? "#ffd66b" : "#fff3c4", rnd(1, 1.6), 46, 0.012);
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
  } else if (rs === "harvest") {   // a puff of gold dust, no ring (gold rings mean armour)
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, v = rnd(1, 2.2); mote(x + Math.cos(a) * 8, y + Math.sin(a) * 8, Math.cos(a) * v, Math.sin(a) * v - 0.5, i % 3 ? "#ffd66b" : "#fff3c4", rnd(1.2, 2), rnd(30, 44), 0.03); }
  } else if (rs === "kraken") {
    addFx({ k: "ring", x, y: k.y - 4, t: 0, life: 18, r0: 8, r1: 46, col: "#3ef2c0" });
    for (let i = 0; i < 3; i++) addFx({ k: "drip", x: x + (i - 1) * 9, y: y + 4, vx: (i - 1) * 1.4, vy: rnd(-3.4, -2.4), col: "#3ef2c0", r: rnd(1.8, 2.4), t: 0, life: 30, g: 0.2, damp: 0.98 });
  }
}

/* ---- Pommes skins: two lines laid on any fighter, bought with Pommes (pal.pommes: 1 Ink Noir, 2 Starfall; Fable, step8/fable-design-2.md
   section 2), UI only ----
   The Road skins' two passes, dispatched from roadSkinBody / roadSkinTop: pmskBody inside the body's lean clipped to the potato (before the
   face), pmskTop after the hats. Decoration only: nothing on a hit flash, no white fills, no blue glows (the night sky keeps to pink and
   violet), no gold rings. Per fighter per frame at most one pattern fill and twelve small shapes; the halftone pattern and the nebula's
   gradient are made once per canvas. The shapes on the body move with the tick alone (no randomness), so a still of a skin is always the same.
   Sizes are Fable's at a 100 px fighter, scaled by rx / 25 (k). */
const skinPm = (f) => (f && f.pal && f.pal.pommes) || 0;
// what each Pommes line does (the select screen and the Skin Rack)
const PMFX = { 1: "Inked like a manga page: halftone shading, a boiling outline, ink strokes on dashes and hits and an inked KO",
  2: "A night sky inside: a breathing nebula, twinkling stars, a comet in orbit, stardust and a starburst on every KO" };
const PMSK_INK = "#1b1a22", PMSK_PAPER = "#ece2cc", PMSK_TAU = Math.PI * 2;
// Ink Noir: where the halftone starts, as a share of the potato's height below its top (0.45: the lower 55 %), under each costume's face and hood
const PMSK_DOTS = { phoenix: 0.45, alchemist: 0.6, odin: 0.5, wizard: 0.4, samurai: 0.5, dragon: 0.45, gunslinger: 0.55, reaper: 0.65 };
// Ink Noir: the three hatch strokes on the shadow side (the light comes from the upper back): x, y (of the half-sizes), length
const PMSK_HATCH = [[0.6, 0.12, 8], [0.7, 0.26, 12], [0.62, 0.42, 10]];
// Starfall: the comet's orbit half-height (x ry) per costume
const PMSK_ORBIT = { phoenix: 0.75, alchemist: 0.6, odin: 0.55, wizard: 0.9, samurai: 0.6, dragon: 0.7, gunslinger: 0.65, reaper: 0.6 };
// Starfall: seven stars: x, y (of the half-sizes), size, twinkle period (frames, 900-1500 ms), phase (they light in turn)
const PMSK_STARS = [[-0.55, -0.5, 1.4, 66, 0], [0.32, -0.62, 1, 80, 0.9], [0.66, -0.12, 1.6, 54, 1.8], [-0.18, 0.06, 0.8, 90, 2.7],
  [-0.7, 0.28, 1.2, 72, 3.6], [0.18, 0.5, 1.1, 60, 4.5], [0.52, 0.4, 0.9, 84, 5.4]];
const PMSK_TILE = 8;   // the halftone tile in pixels (one dot, pitch 3.2 at k = 1, scaled by the pattern's transform)
const pmskCache = new WeakMap();
let pmskTileCv = null;
// the cached pattern and gradient, once per canvas context (a CanvasPattern is made by its context)
function pmskRes(c) {
  let R = pmskCache.get(c);
  if (R) return R;
  if (!pmskTileCv) {
    pmskTileCv = document.createElement("canvas"); pmskTileCv.width = pmskTileCv.height = PMSK_TILE;
    const x = pmskTileCv.getContext("2d"), m = PMSK_TILE / 2;
    x.fillStyle = PMSK_INK; x.beginPath(); x.arc(m, m, PMSK_TILE * (1.2 / 3.2), 0, PMSK_TAU); x.fill();
  }
  const neb = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  neb.addColorStop(0, "#ff4fd8"); neb.addColorStop(0.5, "rgba(122,75,255,0.7)"); neb.addColorStop(1, "rgba(122,75,255,0)");
  R = { dots: c.createPattern(pmskTileCv, "repeat"), neb };
  pmskCache.set(c, R);
  return R;
}
// a stable 0..1 from a whole number (the boiling line's jitter, the speed ticks' places)
function pmskHash(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
// a four-point star (Starfall's stars, comet and sparks), its arms curved in
function pmskStar4(c, x, y, r) {
  c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.closePath();
}
// tests/pwpmskin.py times the two passes: it sets window.__pmskProf = { now, flush, add(slot, ms, readMs) } (never set in play). With flush
// a 1 px read before and after the pass makes the canvas draw what was queued, so the pass's raster is counted; a third read with nothing
// queued measures the read itself (readMs)
function pmskPass(fn, c, f, P, tk) {
  const pr = window.__pmskProf;
  if (!pr) return fn(c, f, P, tk);
  const fl = () => { if (pr.flush) try { c.getImageData(0, 0, 1, 1); } catch (e) { pr.flush = false; } };
  fl(); const t0 = pr.now();
  fn(c, f, P, tk); fl();
  const t1 = pr.now();
  fl();
  pr.add(f.slot, t1 - t0, pr.flush ? pr.now() - t1 : 0);
}
// Starfall's comet: a 3 px star and three fading copies on a tilted ellipse round the potato; the far half in the body pass, the near half on top
function pmskComet(c, f, P, tk, near) {
  const { rx, ry, cy } = P, k = rx / 25, a = rx * 0.95, b = ry * (PMSK_ORBIT[f.spec.look.costume] || 0.6), cs = Math.cos(0.35), sn = Math.sin(0.35);
  const th0 = (tk / 180) * PMSK_TAU + 1.1, col = mix(f.pal.accent, "#ffc2ee", 0.55), a0 = c.globalAlpha;
  for (let i = 3; i >= 0; i--) {
    const th = th0 - i * 0.17;
    if ((Math.sin(th) > 0) !== near) continue;
    const ex = Math.cos(th) * a, ey = Math.sin(th) * b;
    c.globalAlpha = a0 * (i ? 0.55 - i * 0.14 : 1); c.fillStyle = i ? "#ff8fe0" : col;
    c.beginPath(); pmskStar4(c, ex * cs - ey * sn, cy + ex * sn + ey * cs, 3 * k * (1 - i * 0.2)); c.fill();
  }
  c.globalAlpha = a0;
}
function pmskBody(c, f, P, tk) {
  const pm = skinPm(f), { rx, ry, cy } = P, k = rx / 25, cos = f.spec.look.costume, R = pmskRes(c);
  c.save(); potatoPath(c, P); c.clip();
  if (P.dim) c.globalAlpha = 0.5;
  const a0 = c.globalAlpha;
  if (pm === 1) {
    // the screen tone: one pattern fill under the face, the dots on a 45 degree grid that moves with the body
    const y0 = cy - ry + (PMSK_DOTS[cos] || 0.45) * ry * 2, q = ((3.2 * k) / PMSK_TILE) * Math.SQRT1_2;
    if (R.dots && R.dots.setTransform) {
      R.dots.setTransform(new DOMMatrix([q, q, -q, q, 0, 0]));
      c.globalAlpha = a0 * 0.35; c.fillStyle = R.dots; c.fillRect(-rx * 1.3, y0, rx * 2.6, cy + ry * 1.2 - y0);
    }
    // three hatch strokes on the shadow side, boiling with the outline
    const bo = (tk / 5) | 0, ox = (pmskHash(bo * 2) - 0.5) * 1.2 * k, oy = (pmskHash(bo * 2 + 1) - 0.5) * 1.2 * k;
    c.globalAlpha = a0 * 0.8; c.strokeStyle = PMSK_INK; c.lineWidth = k; c.lineCap = "round";
    c.beginPath();
    for (const [x, y, len] of PMSK_HATCH) { const hx = x * rx + ox, hy = cy + y * ry + oy, d = len * k * 0.5; c.moveTo(hx - d * 0.57, hy + d * 0.82); c.lineTo(hx + d * 0.57, hy - d * 0.82); }
    c.stroke();
    c.restore();
    // the boiling line: the outline drawn again in ink, a little off, the offset changing every 83 ms (outside the clip, under the face and hats)
    c.save(); if (P.dim) c.globalAlpha = 0.5;
    c.translate(ox, oy); potatoPath(c, P); c.translate(-ox, -oy);
    c.strokeStyle = PMSK_INK; c.lineWidth = 1.2 * k; c.lineJoin = "round"; c.stroke();
    c.restore();
    return;
  }
  // Starfall: the nebula in the upper back, breathing over 2400 ms (lower under the Alchemist's and the Reaper's hoods)
  const nr = ry * 0.9, nx = -rx * 0.38, ny = cy - ry * 0.4 + (cos === "alchemist" || cos === "reaper" ? ry * 0.15 : 0);
  c.globalAlpha = a0 * (0.3 + 0.08 * Math.sin((tk / 144) * PMSK_TAU));
  c.save(); c.translate(nx, ny); c.scale(nr, nr); c.fillStyle = R.neb; c.fillRect(-1, -1, 2, 2); c.restore();
  // seven stars twinkling in turn, drifting down 2 px every 4 s and coming back in at the top
  c.fillStyle = "#ffc8ef";
  for (const [x, y, sz, per, ph] of PMSK_STARS) {
    const tw = Math.max(0, Math.sin((tk / per) * PMSK_TAU + ph)), hh = ry * Math.sqrt(Math.max(0.05, 1 - x * x)), dy = (tk * 2 * k) / 240;
    const yy = cy - hh + ((((y * ry + hh + dy) % (2 * hh)) + 2 * hh) % (2 * hh));
    c.globalAlpha = a0 * (0.35 + 0.65 * tw * tw);
    c.beginPath(); pmskStar4(c, x * rx, yy, sz * k * (1 + 0.6 * tw)); c.fill();
  }
  c.globalAlpha = a0;
  pmskComet(c, f, P, tk, false);
  c.restore();
}
function pmskTop(c, f, P, tk) {
  const pm = skinPm(f), { rx, ry, cy } = P, k = rx / 25;
  c.save();
  if (P.dim) c.globalAlpha = 0.5;
  if (pm === 1) {
    // four ink speed ticks behind him while he runs, each there for 60 ms
    if (f.state === "run") {
      c.globalAlpha *= 0.5; c.strokeStyle = PMSK_INK; c.lineWidth = 1.4 * k; c.lineCap = "round";
      c.beginPath();
      for (let i = 0; i < 4; i++) {
        const n = ((tk + i) >> 2) * 4 + i, age = (tk + i) & 3, len = (10 + 6 * pmskHash(n * 3)) * k;
        const x0 = -rx * (1.05 + 0.3 * pmskHash(n * 3 + 1)) - age * 1.5 * k, y = cy - ry * 0.75 + ry * 1.5 * pmskHash(n * 3 + 2);
        c.moveTo(x0, y); c.lineTo(x0 - len, y);
      }
      c.stroke();
    }
  } else pmskComet(c, f, P, tk, true);
  c.restore();
}
// ambient bits off the figure: Ink Noir's dash strokes, Starfall's stardust (each with its cap of how many are alive)
function pmskCount(slot, kind) { let n = 0; for (const e of fx) if (e.pmsk === slot && e.pmT === kind) n++; return n; }
function pmskTick(f, pm, tk, slot) {
  const w = f.s.w, h = f.s.h, fc = f.facing, k = (w * 0.56) / 25, dash = f.spr > 0 && f.state === "run";
  if (pm === 1) {
    // the dash: five ink strokes behind, again every 4 frames of the burst, at most ten alive
    if (dash && f.spr % 4 === 1) {
      const n = Math.min(5, 10 - pmskCount(slot, "d"));
      for (let i = 0; i < n; i++) addFx({ k: "pmsk-ink", x: f.x - fc * (w * 0.42 + rnd(0, 10)), y: f.y - h * (0.1 + 0.18 * i + rnd(0, 0.08)), vx: -fc * rnd(0.6, 1.4), vy: 0,
        ang: fc > 0 ? 0 : Math.PI, len: rnd(24, 40) * k, w: 2 * k, col: PMSK_INK, al: 0.85, t: 0, life: 7, damp: 0.9, pmsk: slot, pmT: "d" });
    }
    return;
  }
  // a stardust mote every 12 frames, at most four alive; the dash throws three a frame, at most twelve alive
  if (tk % 12 === (slot * 5) % 12 && pmskCount(slot, "a") < 4)
    addFx({ k: "mote", x: f.x + rnd(-0.55, 0.55) * w, y: f.y - h * rnd(0.25, 0.95), vx: rnd(-0.25, 0.25), vy: rnd(-0.5, -0.15), col: Math.random() < 0.5 ? "#ffb3ec" : "#c9a6ff",
      r: rnd(1, 1.5), t: 0, life: 40, g: 0.004, damp: 0.97, pmsk: slot, pmT: "a" });
  if (dash) for (let i = 0, n = Math.min(3, 12 - pmskCount(slot, "d")); i < n; i++)
    addFx({ k: "mote", x: f.x - fc * (w * 0.3 + rnd(0, 12)), y: f.y - h * rnd(0.1, 0.85), vx: -fc * rnd(0.6, 1.8), vy: rnd(-0.5, 0.2), col: i % 2 ? "#ffb3ec" : "#c9a6ff",
      r: rnd(1, 1.5), t: 0, life: 12, g: 0, damp: 0.95, pmsk: slot, pmT: "d" });
}
// Ink Noir: an eight-point ink star where a hit lands (an outline, so the hit's own flash and sparks show through)
function pmskHit(f, e) {
  const k = (f.s.w * 0.56) / 25;
  addFx({ k: "pmsk-star", x: e.x, y: e.y, r0: 14 * k, r1: 24 * k, lw: 2.2 * k, col: PMSK_INK, rot: rnd(0, 0.8), t: 0, life: 6 });
}
// a Pommes skin's KO effect, off the fighter who scored it
function pmskKo(k, pm) {
  const x = k.x, y = k.y - k.s.h * 0.6, kk = (k.s.w * 0.56) / 25, ac = k.pal.accent;
  if (pm === 1) {
    // a ring of ink dots, eight spot-colour strokes bursting out and a drawn KO at his head with a misprint ghost
    for (let i = 0; i < 24; i++) { const a = (i / 24) * PMSK_TAU, v = rnd(1.5, 2.5); addFx({ k: "pmsk-ink", x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(2, 4), col: PMSK_INK, t: 0, life: 32, damp: 0.95 }); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PMSK_TAU + 0.2, d = 18 + 40 * kk; addFx({ k: "pmsk-ink", x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, ang: a, len: 40 * kk, w: 3 * kk, col: ac, t: 0, life: 31, damp: 0.95 }); }
    addFx({ k: "pmsk-word", x, y: k.y - k.s.h - 8, col: ac, t: 0, life: 30 });
  } else {
    // a magenta ring (never gold) and eighteen star sparks
    addFx({ k: "ring", x, y, t: 0, life: 20, r0: 10, r1: 50, col: "#ff4fd8" });
    for (let i = 0; i < 18; i++) { const a = (i / 18) * PMSK_TAU + rnd(-0.12, 0.12), v = rnd(1, 2.4); addFx({ k: "pmsk-spark", x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.3, r: rnd(2.2, 3.4) * kk, col: i % 2 ? "#ffb3ec" : "#c9a6ff", t: 0, life: 36, damp: 0.96, ph: i }); }
  }
}
// draws the Pommes particle kinds (from drawSkinFx); false for the others
function pmskDrawFx(c, e, a) {
  switch (e.k) {
    case "pmsk-ink":   // an ink dot, or a brush flick: round at the head (x, y), thinning to a point behind it along ang
      c.globalAlpha = a * (e.al || 1); c.fillStyle = e.col; c.beginPath();
      if (e.len) {
        const cs = Math.cos(e.ang), sn = Math.sin(e.ang), hw = e.w / 2, ln = e.len * (0.6 + 0.4 * a);
        c.moveTo(e.x - cs * ln, e.y - sn * ln); c.lineTo(e.x - sn * hw, e.y + cs * hw); c.arc(e.x, e.y, hw, e.ang + Math.PI / 2, e.ang - Math.PI / 2, true); c.closePath();
      } else c.arc(e.x, e.y, e.r * (0.7 + 0.3 * a), 0, PMSK_TAU);
      c.fill();
      return true;
    case "pmsk-star": {   // Ink Noir's hit: an eight-point star outline growing 14 -> 24 as it fades
      const r = lerp(e.r0, e.r1, ease(e.t / e.life));
      c.globalAlpha = a * 0.7; c.strokeStyle = e.col; c.lineWidth = e.lw; c.lineJoin = "miter";
      c.beginPath();
      for (let i = 0; i < 16; i++) { const q = e.rot + (i / 16) * PMSK_TAU, rr = i % 2 ? r * 0.5 : r; c.lineTo(e.x + Math.cos(q) * rr, e.y + Math.sin(q) * rr); }
      c.closePath(); c.stroke(); c.lineJoin = "round";
      return true;
    }
    case "pmsk-word": {   // Ink Noir's KO: the word stamped at 7 % of the screen's height, ink on a paper edge with a spot-colour misprint 2 px off
      const z = cam.z || 1, s = (L.gh * 0.07) / z, px = 2 / z, q = e.t / e.life, sc = q < 0.12 ? 0.75 + q * 2.1 : 1;
      c.save(); c.translate(e.x, e.y - q * 8); c.rotate(-0.1); c.scale(sc, sc);
      c.font = `italic 900 ${s.toFixed(1)}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textAlign = "center"; c.textBaseline = "alphabetic";
      c.globalAlpha = Math.min(1, a / 0.3);
      c.fillStyle = e.col; c.fillText("KO", px, px);
      c.lineJoin = "round"; c.lineWidth = 2.5 * px; c.strokeStyle = PMSK_PAPER; c.strokeText("KO", 0, 0);
      c.fillStyle = PMSK_INK; c.fillText("KO", 0, 0);
      c.restore();
      return true;
    }
    case "pmsk-spark": {   // Starfall's KO: a four-point star spark that twinkles as it flies, on a faint magenta glow
      const tw = 0.6 + 0.4 * Math.abs(Math.sin(e.t * 0.35 + e.ph)), r = e.r * (0.5 + 0.5 * a) * tw;
      c.globalAlpha = a * 0.3; c.fillStyle = "#ff4fd8"; c.beginPath(); c.arc(e.x, e.y, r * 0.9, 0, PMSK_TAU); c.fill();   // a magenta glow, so it reads on a pale sky
      c.globalAlpha = a * tw; c.fillStyle = e.col; c.beginPath(); pmskStar4(c, e.x, e.y, r); c.fill();
      return true;
    }
  }
  return false;
}
