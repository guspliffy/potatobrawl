/* ===================== skin effects =====================
   Each fighter's four skins add effects step by step (free, 60, 150, 300 chips): 60 adds a small
   effect around the fighter, 150 adds one tied to a move, 300 adds a change on the figure itself
   and a KO effect. The rules: effects are decoration only and never
   change a fighter's size or an attack's size or timing; they avoid the colours the game uses as
   signals (white hit flash, blue invincibility glow, gold armour ring); they stay close to the
   fighter; and they are the first thing dropped when a phone can't keep up. Both players' skins
   are part of the online match setup, so both screens show the same effects. */
const FXTEXT = {
  phoenix: ["", _t("Embers drift off the wings"), _t("Embers, plus a flame ring on every air jump"), _t("Embers, flame rings, wings that flicker like fire and a flare on every KO")],
  alchemist: ["", _t("Green drips from the hood"), _t("Drips, plus a vapour trail on the toxic orb"), _t("Drips, vapour trail, glowing eyes and two-colour zaps")],
  odin: ["", _t("Feathers drift when the raven comes back"), _t("Feathers, plus frosty breath"), _t("Feathers, frosty breath, glowing runes on the armour and a rune ring on every KO")],
  wizard: ["", _t("Sparkles circle the staff tip"), _t("Sparkles, plus a glitter trail on the bolt"), _t("Sparkles, glitter, twinkling stars on the hat and a star trail on every KO")],
  samurai: ["", _t("Petals drift while running"), _t("Petals, plus ink-brush slashes"), _t("Petals, ink slashes, a glowing blade and a flash line on Quick Draw")],
  dragon: ["", _t("Smoke curls from his mouth"), _t("Smoke, plus a gust ring on every wing flap"), _t("Smoke, gusts, glowing wing bones and a fire roar on every KO")],
  gunslinger: ["", _t("Smoke curls from the barrels"), _t("Smoke, plus brass shells on every Twin Shot"), _t("Smoke, shells, gold pistols and a gold burst on every KO")],
  reaper: ["", _t("Dark wisps drift off the hood"), _t("Wisps, plus amber soul sparks on every scythe swing"), _t("Wisps, soul sparks, a ghost-lit blade and a soul burst on every KO")],
};
// a Road skin (palettes 4-6, pal.road = the boss that gives it), the Harvest skin (palette 7, pal.road = "harvest", ui/harvest.js) and a
// Pommes skin (palettes 8-9, pal.pommes = the line) have none of the chip skins' effects: their own overlay (skinRoad, skinPm)
const skinLvl = (f) => { const i = f.spec.palettes.indexOf(f.pal); return i < 0 || f.pal.road || f.pal.pommes ? 0 : i; };
const skinRoad = (f) => (f.pal && f.pal.road) || "";
// what each Road skin does (the select screen's note)
const ROADFX = { scratch: _t("Roasted dark with red horns, a devil's tail and ember cracks that spit sparks"),
  zorp: _t("A glass specimen dome over the head and a green glow from below"), kraken: _t("A fishing net, two kelp ribbons, barnacles, a starfish and rising bubbles"),
  harvest: _t("Solid gold with a wheat laurel, a sheen band and gold dust that bursts on every KO") };
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
      if (e.type === "hit" && f && skinPm(f) && e.def !== undefined && fxMoves() && hkTier(e) >= 2) skcFleck(g, f, e);   // a Pommes skin's heavy-hit fleck
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
function roadSkinBody(c, f, P, tk, flash, K) {
  if (K) { if (!flash) pmskPass(skcBody, c, f, P, tk, K); return; }   // a carved figure (ui/carve.js): the Carved Ink skins below
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
function roadSkinTop(c, f, P, tk, flash, K) {
  if (K) { if (!flash) pmskPass(skcTop, c, f, P, tk, K); return; }
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
  const fig = CV_FIG[f.spec.look.costume];
  if (rs === "scratch" && tk % 20 === (slot * 11) % 20) {   // off one of the three cracks (skcAtop), a third of the way up it
    const k = (tk / 20 | 0) % 3, B = fig ? fig.body : { x: 0, y: -h * 0.4 };
    mote(f.x + fc * (B.x - 16 + 11 * k), f.y + B.y + 8 - 8 * (k % 2), rnd(-0.3, 0.3), rnd(-0.9, -0.5), Math.random() < 0.5 ? "#ff9a3a" : "#ff6a2b", 1.5, 40, -0.01);
  }
  if (rs === "harvest" && tk % 14 === (slot * 5) % 14) {   // a fleck of gold dust lifts off and sinks away
    mote(f.x + rnd(-0.5, 0.5) * w, f.y - h * rnd(0.3, 0.85), rnd(-0.25, 0.25), rnd(-0.6, -0.2), Math.random() < 0.6 ? "#ffd66b" : "#fff3c4", rnd(1, 1.6), 46, 0.012);
  }
  if (rs === "kraken" && tk % 40 === (slot * 13) % 40) {   // off the tip of the long kelp ribbon (skcKelp)
    const C = SKC_CATCH[f.spec.look.costume] || [0, 0, 0, -w * 0.4, -h * 0.5];
    addFx({ k: "drip", x: f.x + fc * (C[3] - 7), y: f.y + C[4] + 29, vx: 0, vy: 0.3, col: "#bfe8e0", r: rnd(1.4, 1.9), t: 0, life: 15, g: 0.2, damp: 0.98 });
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

/* ===================== Carved Ink skins: atop paint, fittings, live bits (Fable, redesign/pr3-design.md sections 0-4; UI only) =====================
   A skin of a carved figure (ui/carve.js) is four layers, cheapest first: 1 its colours (the fig files' chip / won / pm), and here
   2 ATOP PAINT (skcAtop): flat shapes over the figure's body-level parts (SKC_PARTS: body, head, hat, hood, cloak, robe, poncho, cape), in the
     standing frame: charred feet and ember cracks, the Specimen's glow from below, Harvest Gold's bronze foot shadow and sheen band, Ink
     Noir's halftone, Starfall's nebula and stars. The kit bakes it into its sprites (K.paintRun: source-atop) and, where it draws paths (a
     big draw: the select screen, the Skin Rack's model; the dimmed figure; a manga page), clips it to the parts' outline (skcClip). The
     faces, lenses and the like are drawn after it, so none of it covers a face. Limbs, wings and weapons keep the colours only.
   3 FITTINGS (K.fit): new carved parts in fixed colours, one sprite each per skin and zoom level: behind the figure (skinBack: the tail, the
     disc), over its parts and under the front arm (the "top" slot: horns, the net with its kelp, starfish and barnacles, the laurel), in
     front of it all (skinFront: the dome).
   4 LIVE: at most 12 small fills or strokes a frame per fighter (motes, glints, the orbit, the bead, bubbles, drops) and the particles of
     skinTick / skinEvent.
   Every layer: flat tones, nothing on a hit flash, half alpha while P.dim, no white fills, no blue glows, no gold rings, no outline ring
   round the body; nothing drawn on the figure uses Math.random (a still of a skin is always the same). A slow phone drops the live bits
   in the spec's order (skcDrop): outer stars and ink drops, then bubbles and the bead, then chip motes and the crack pulse; never a fitting.
   The hooks: K.skinBack / K.skinFront (every skin but the free one; the standing frame: squash, crouch and lean applied), the body slot
   ("skin" in K.stack, roadSkinBody with K: Devil's Roast's crack pulse, Ink Noir's boiling line) and the top slot ("top", roadSkinTop
   with K). Never in the 2v2 rim pass. Top-level names here start with skc / SKC_. */
const SKC_INK = "#1b1a22", SKC_PAPER = "#f1e8d2", SKC_HORN = "#c9262a", SKC_TAIL = "#a01f1f";
// the parts that take a skin's atop paint, per figure (Devil's Roast also lays it on the Phoenix's tail ribbons: their charred tips)
const SKC_PARTS = { phoenix: ["body"], alchemist: ["mantle", "body", "hood"], odin: ["cape", "body", "head"], wizard: ["body", "robe", "hat"],
  samurai: ["body", "plates"], dragon: ["body"], gunslinger: ["body", "poncho", "hat"], reaper: ["cloak", "hood"] };
// the chip skins' motes and glints (section 1): the back column x, its low and high y, the glints G1 and G2, the 150 and 300 mote colours
const SKC_MOTE = { phoenix: [-54, -14, -74, 22, -66, -36, -82, "#b6ff6a", "#ffd23f"], alchemist: [-42, -8, -56, 24, -56, -30, -72, "#ffd9a0", "#b79af5"],
  odin: [-46, -6, -56, 30, -64, 4, -80, "#ffe08a", "#a9a0d6"], wizard: [-28, -10, -70, 20, -80, -26, -68, "#b6ff6a", "#ffb02e"],
  samurai: [-48, -8, -68, 26, -58, -20, -70, "#ff6a5a", "#c9a6ff"], dragon: [-60, -10, -70, 32, -56, -14, -80, "#b79af5", "#ff8a1f"],
  gunslinger: [-44, -8, -68, 38, -66, -24, -82, "#ffd66b", "#ffe08a"], reaper: [-32, -6, -66, 26, -74, -20, -84, "#ff8a3c", "#8dffd0"] };
// Devil's Roast (2.1): the far and near horn roots, the tail's root, the horns' height (13 unless given). The Dragon wears his own horns,
// bigger (fig-dragon.js); the Phoenix has no tail (his ribbons' tips are charred: skcShapes)
const SKC_ROAST = { phoenix: [[5, -58], [17, -52], null], alchemist: [[-4, -59], [12, -55], [-16, -8]], odin: [[-4, -69], [18, -61], [-30, -6], 16],
  wizard: [[-19, -65], [20, -64], [-14, -10]], samurai: [[-9, -55], [12, -54], [-12, -16], 11], gunslinger: [[-15, -62], [17, -60], [-14, -18]],
  reaper: [[-5, -74], [17, -72], [-22, -6]] };
// Specimen (2.2): the bell's middle x, its collar line by, its half width rx and its apex ty
const SKC_DOME = { phoenix: [2, -26, 25, -92], alchemist: [0, -20, 28, -78], odin: [0, -25, 31, -84], wizard: [0, -31, 35, -106], samurai: [0, -27, 26, -80],
  dragon: [4, -24, 29, -78], gunslinger: [1, -31, 39, -83], reaper: [3, -32, 25, -92] };
// Deep Catch (2.3): the net's back and front x and its rope line ny, the kelp's root K, the starfish (x, y, r), the barnacles
const SKC_CATCH = { phoenix: [-18, 20, -34, -10, -50, -4, -24, 8, 10, -18], alchemist: [-24, 23, -26, -24, -46, -14, -45, 8, 14, -13],
  odin: [-27, 27, -30, -22, -48, -12, -31, 8, -14, -57], wizard: [-19, 20, -34, -27, -60, -4, -76, 7, 10, -14],
  samurai: [-21, 22, -32, -14, -50, -9, -40, 7, 10, -20], dragon: [-24, 26, -30, -12, -50, 8, -20, 8, -18, -38],
  gunslinger: [-26, 25, -34, -30, -62, -10, -30, 8, 8, -70], reaper: [-25, 23, -36, -18, -52, -9, -22, 8, -10, -62] };
// Harvest Gold (2.4): the laurel's middle and radii; the five glints (x, y in the body's half sizes from its middle, r)
const SKC_LAUREL = { phoenix: [6, -46, 17, 15], alchemist: [6, -38, 18, 17], odin: [0, -52, 21, 17], wizard: [1, -60, 17, 13], samurai: [1, -44, 18, 15],
  dragon: [4, -44, 17, 14], gunslinger: [1, -60, 15, 13], reaper: [4, -58, 17, 17] };
const SKC_GLINT = [[-1.3, -1.0, 4.5], [1.5, -0.15, 3.6], [-1.0, 0.9, 3], [1.1, -1.7, 3.2], [0.3, 1.15, 2.4]];
// Ink Noir (3.1): the accent, the disc's middle and radius (up and behind the head)
const SKC_DISC = { phoenix: ["#ff6a2b", -24, -66, 22], alchemist: ["#8dff3a", -18, -56, 22], odin: ["#ff3d57", -26, -62, 22], wizard: ["#a86bff", -20, -78, 22],
  samurai: ["#2fd39a", -18, -54, 22], dragon: ["#ffc21f", -16, -66, 20], gunslinger: ["#3ef2c0", -18, -70, 22], reaper: ["#ffb444", -16, -66, 22] };
const SKC_SHAPES = new Map(), SKC_PARTC = new Map();
// a slow phone drops the live bits in the spec's order (section 4): 1 outer stars and ink drops, 2 bubbles and the bead, 3 chip motes and the
// crack pulse (PERF.q steps up when a match cannot hold ~45 fps)
const skcDrop = (n) => PERF.q >= n;
// the mockup's hash (redesign/mockups/src/fx.js rnd): a fixed 0..1 per whole number
const skcHash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// what a skin draws here: "scratch" | "zorp" | "kraken" | "harvest" (won), "noir" | "star" (Pommes), "c2" | "c3" (the 150 and 300 chip skins), or ""
function skcKind(f) {
  const p = f.pal;
  if (!p) return "";
  if (p.pommes) return p.pommes === 1 ? "noir" : "star";
  if (p.road) return p.road;
  const i = cvPalIdx(f);
  return i === 2 || i === 3 ? "c" + i : "";
}
// a pass with something live on the potato (ui/carve.js: the "skin" token breaks the body's sprite only then)
function skcBodyLive(f) { const p = f.pal; return !!p && (p.road === "scratch" || p.pommes === 1); }
// the parts of K's figure that take its skin's atop paint, or null (ui/carve.js K.paintRun)
function skcAtopParts(K) {
  const k = skcKind(K.f);
  if (k !== "scratch" && k !== "zorp" && k !== "harvest" && k !== "noir" && k !== "star") return null;
  const key = K.fig.id + ":" + k;
  let s = SKC_PARTC.get(key);
  if (!s) { s = new Set(SKC_PARTS[K.fig.id] || ["body"]); if (k === "scratch" && K.fig.id === "phoenix") s.add("tail"); SKC_PARTC.set(key, s); }
  return s;
}
// the outline of a stretch of carved parts (the union of their ink and of what reaches past it), for a clip; kept on the figure
function skcClip(fig, seg) {
  const m = fig.skcClip || (fig.skcClip = new Map()), key = seg.join(",");
  let p = m.get(key);
  if (!p) {
    p = new Path2D();
    for (const n of seg) for (const o of cvPartOps(fig, n)) if (o.rp) for (const Q of o.rp) skcPoly(p, Q);
    m.set(key, p);
  }
  return p;
}
// is (x, y) on the figure's face, padded by d: the box of its eyes and brows, or its mouth's (ui/carve.js cvFace)
function skcOnFace(fig, x, y, d) {
  const F = fig.face, s = F.s || 1, M = F.mouth;
  if (Math.abs(x - F.x) < 10.5 * s + d && Math.abs(y - F.y) < 7.5 * s + d) return true;
  return !!M && M.k !== "none" && Math.abs(x - M.x) < 6 * s + d && Math.abs(y - M.y) < 4 * s + d;
}
// a closed polygon added to a path
function skcPoly(p, Q) { p.moveTo(Q[0][0], Q[0][1]); for (let i = 1; i < Q.length; i++) p.lineTo(Q[i][0], Q[i][1]); p.closePath(); }
// Devil's Roast's ember crack k (0..2): from (B.x - 18 + 11k, B.y + 14 - 8 (k % 2)), five points up the torso; it stops short of the face
// (where a crack would run into a mouth or an eye: Phoenix, Alchemist, Reaper). Kept on the figure
function skcCrack(fig, k) {
  const L = fig.skcCr || (fig.skcCr = []);
  if (L[k]) return L[k];
  const B = fig.body, x = B.x - 18 + 11 * k, y = B.y + 14 - 8 * (k % 2), C = [[0, 0], [3, -4], [1, -9], [6, -12], [5, -17]].map((q) => [x + q[0], y + q[1]]), out = [C[0]];
  for (let i = 1; i < C.length; i++) {
    const a = C[i - 1], b = C[i];
    if (!skcOnFace(fig, b[0], b[1], 1.5)) { out.push(b); continue; }
    let lo = 0, hi = 1;
    for (let j = 0; j < 12; j++) { const m = (lo + hi) / 2; if (skcOnFace(fig, a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, 1.5)) hi = m; else lo = m; }
    out.push([a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo]);
    break;
  }
  return (L[k] = out);
}
// a skin's atop paint on one figure (and on the Phoenix's tail ribbons alone: tail): a list of [Path2D, colour, alpha], made once
function skcShapes(fig, k, tail) {
  const key = fig.id + ":" + k + (tail ? ":t" : "");
  let L = SKC_SHAPES.get(key);
  if (L) return L;
  const B = fig.body, rect = (y0, y1) => { const p = new Path2D(); p.rect(-120, y0, 240, y1 - y0); return p; };
  L = [];
  if (k === "scratch") {
    if (tail) {   // the outer third of both flame ribbons charred (CV_PHX_TAIL runs from x -8 to -44), a ragged edge
      const p = new Path2D(); skcPoly(p, [[-31, -34], [-34, -24], [-30.5, -15], [-34, -7], [-31, 4], [-90, 4], [-90, -34]]); L.push([p, "#3a1410", 1]);
    }
    // charred feet: below y -14 mixed 35 % to #1a0a0c, below -6 mixed 80 % (two flat bands, each with a ragged top edge: 4 teeth 3 deep)
    const saw = (y0) => { const p = new Path2D(), Q = [[-120, 12], [-120, y0]]; for (let i = 0; i <= 8; i++) Q.push([-36 + 9 * i, y0 - (i % 2) * 3]); Q.push([120, y0], [120, 12]); skcPoly(p, Q); return p; };
    L.push([saw(-14), "#1a0a0c", 0.35], [saw(-6), "#1a0a0c", 0.692]);
    if (!tail) {   // the three ember cracks: an orange line 2.8 wide with a hot core 1.1 wide
      const o = new Path2D(), cr = new Path2D();
      for (let i = 0; i < 3; i++) { const C = skcCrack(fig, i); skcPoly(o, cvBrush(C, 2.8)); skcPoly(cr, cvBrush(C, 1.1)); }
      L.push([o, "#ff5a1f", 1], [cr, "#ffe08a", 1]);
    }
  } else if (k === "zorp") L.push([rect(B.y + B.ry * 0.3, 12), "#9dff5a", 0.22]);   // the glow from below, flat
  else if (k === "harvest") {
    L.push([rect(-12, 12), "#8c4a14", 0.5], [rect(-5, 12), "#8c4a14", 0.5]);   // the bronze foot shadow: 0.5, then 0.75 below y -5
    const p = new Path2D();   // the sheen band across the whole figure at 42 degrees: a wide band and a thin one
    skcPoly(p, [[-70, -30], [30, -120], [46, -120], [-54, -30]]); skcPoly(p, [[-40, -20], [60, -110], [65, -110], [-35, -20]]);
    L.push([p, "#fff3b0", 0.5]);
  } else if (k === "noir") {   // the halftone: deep-ink dots on a staggered grid (3.2 x 2.3), r 0.25 at the body's middle growing to 1.25 at the feet
    const p = new Path2D();
    for (let j = 0, y = B.y; y <= 2; j++, y = B.y + j * 2.3) {
      const r = 0.25 + (y - B.y) / -B.y;
      for (let x = -64 + (j % 2) * 1.6; x <= 64; x += 3.2) { p.moveTo(x + r, y); p.arc(x, y, r, 0, CV_TAU); }
    }
    L.push([p, SKC_INK, 1]);
  } else if (k === "star") {
    const nb = (r) => { const p = new Path2D(); p.arc(B.x + 8, B.y - 12, r, 0, CV_TAU); return p; };
    L.push([nb(28), "#7a5aff", 0.3], [nb(16), "#ff6ad5", 0.45], [rect(-14, 12), "#0e0a1f", 0.3]);   // the nebula: three flat blobs
    const st = new Path2D(), dt = new Path2D();   // sixteen stars over the whole figure, every fourth a four-point star (none on the face)
    for (let i = 0; i < 16; i++) {
      const x = -34 + 68 * skcHash(i), y = -6 - 80 * skcHash(i + 40);
      if (skcOnFace(fig, x, y, 1)) continue;
      if (i % 4 === 0) pmskStar4(st, x, y, 2.6); else { dt.moveTo(x + 0.8, y); dt.arc(x, y, 0.8, 0, CV_TAU); }
    }
    L.push([st, "#fff6d8", 1], [dt, "#fff6d8", 0.9]);
  }
  SKC_SHAPES.set(key, L);
  return L;
}
// layer 2: the atop paint of K's skin in the current transform (the standing frame of the parts just drawn; the caller has set source-atop
// or a clip). part: the first part of the stretch (the Phoenix's "tail" has its own)
function skcAtop(c, K, part) {
  const L = skcShapes(K.fig, skcKind(K.f), part === "tail");
  if (K.P.dim) c.globalAlpha *= 0.5;
  const ga = c.globalAlpha;
  for (const [p, col, a] of L) { c.globalAlpha = ga * a; c.fillStyle = col; c.fill(p); }
  c.globalAlpha = ga;
}

/* ---- layer 3: the fittings, carved once (CV_Carve in fixed colours; K.fit bakes them) ---- */
// Devil's Roast: two horns (the root 5 wide, 13 high, curving outwards), in front of the headgear
function skcHorns(S, id) {
  const R = SKC_ROAST[id], k = (R[3] || 13) / 13;
  for (const [r, s] of [[R[0], -1], [R[1], 1]]) {
    const P = [[0, 0], [3 * s, -10], [8 * s, -15, 1], [7 * s, -5], [5 * s, 1, 1]].map((q) => [r[0] + q[0] * k, r[1] + q[1] * k, q[2]]);
    S.cel(cvSm(P), SKC_HORN, { lw: 2, sh: [1.3, -1.3], shade: cvSh(SKC_HORN) });
  }
}
// Devil's Roast: the arrow tail from its root at (0, 0), behind the figure
function skcTail(S) {
  S.cel(cvSm([[0, 0], [-16, 4], [-26, -8], [-22, -20], [-30, -22, 1], [-22, -32, 1], [-17, -22, 1], [-19, -10], [-14, -4], [0, -6]]), SKC_TAIL,
    { lw: 2.2, sh: [2, -2], shade: cvSh(SKC_TAIL) });
}
// Specimen: the glass bell from the collar line up (a cubic over the apex)
function skcBell(id) {
  const [x, by, rx, ty] = SKC_DOME[id], arc = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40, u = 1 - t; arc.push([x + rx * (3 * u * t * t + t * t * t - u * u * u - 3 * u * u * t), by * (u * u * u + t * t * t) + (ty - 8) * 3 * u * t]); }
  const ap = 0.25 * by + 0.75 * (ty - 8);   // the bell's top
  return { x, by, rx, ty, arc, ap, hh: by - ap, yc: ap + 0.18 * (by - ap) };
}
// Specimen: the bell, its slime cap and drips, the reflection, the glass line, the collar and its clasp
function skcDomeCarve(S, id) {
  const D = skcBell(id), { x, by, rx, ty, arc, hh, yc } = D, h = by - ty, bell = cvPos(arc.slice());
  S.add([bell], "#beffdc", 0, 0.2);   // the glass
  // the slime: a scalloped cap over the top 18 % with three drips (6, 14 and 9 long, 3.5 wide, round ends), on the glass; ink on its lower edge
  const edge = [], drips = [[-0.35, 6], [0.05, 14], [0.45, 9]];
  for (let xx = x - rx - 4, di = 0; xx <= x + rx + 4; xx += 1.5) {
    const d = drips[di];
    if (d && xx >= x + d[0] * rx - 1.75) {
      const dx = x + d[0] * rx, L = d[1];
      edge.push([dx - 1.75, yc + 1], [dx - 1.75, yc + L], [dx - 1.2, yc + L + 1.2], [dx, yc + L + 1.75], [dx + 1.2, yc + L + 1.2], [dx + 1.75, yc + L], [dx + 1.75, yc + 1]);
      xx = dx + 1.75; di++; continue;
    }
    edge.push([xx, yc + 1.6 * Math.abs(Math.sin(((xx - x) / rx) * Math.PI * 1.5))]);
  }
  S.clipH = cvHull(bell);
  S.add([edge.concat([[x + rx + 6, ty - 14], [x - rx - 6, ty - 14]])], "#9dff5a", 0, 0.55);
  S.add([cvBrush(edge, 1)], "ink");
  S.clipH = null;
  // the reflection: a wedge on the upper back quarter (5 wide at the bottom, 1.5 at the top) and two dots on the front top
  S.add([cvBrush([[x - rx * 0.62, by - h * 0.35], [x - rx * 0.46, by - h * 0.62], [x - rx * 0.3, by - h * 0.86]], 5, 1.5)], "#eaffd6", 0, 0.55);
  S.add([cvCirc(x + rx * 0.5, by - hh * 0.7, 2), cvCirc(x + rx * 0.3, by - hh * 0.84, 1.3)], "#eaffd6", 0, 0.9);
  // the glass line: pale, then ink
  S.add([cvBrush(arc, 2.4)], "#e6fff0"); S.add([cvBrush(arc, 1)], "ink");
  // the collar band and the clasp
  S.cel(cvRect(x - rx - 3, by - 3, rx * 2 + 6, 6.5), "#5ae08a", { lw: 2, sh: [2, -1.5], shade: cvSh("#5ae08a") });
  S.cel(cvCirc(x + 4, by + 0.25, 3.4), "#eaffd6", { lw: 1.6, sh: 0 });
}
// Deep Catch: the second kelp ribbon, the net bag over body and legs (its mesh, rope, corks and lead weights), the starfish, the barnacles
function skcCatchCarve(S, id) {
  const [x0, x1, ny, kx, ky, sx, sy, sr, bx, by] = SKC_CATCH[id];
  // the second kelp ribbon: shorter (22), hanging still 8 units in front of the long one's root, a pale line down its middle
  const rx0 = kx + 8, mid = [[rx0, ky], [rx0 - 2, ky + 6], [rx0 + 1, ky + 12], [rx0 - 2, ky + 18], [rx0 - 1, ky + 22]];
  S.cel(cvBrush(cvSm(mid, true), 4.4, 1.6), "#3ebf8a", { lw: 2, sh: [1.2, -1], shade: cvSh("#3ebf8a") });
  S.line([[rx0, ky + 2], [rx0 - 2, ky + 6], [rx0 + 1, ky + 12], [rx0 - 1.6, ky + 16.5]], 0.9, "#8fe0b0");
  // the bag: the rope line (ny at the back, ny + 2 at the front, sagging 2 in the middle) down to y -3, the bottom edge four scallops
  const top = [], yb = -3, pt = [], bot = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; top.push([x0 + (x1 - x0) * t, ny + 2 * t + 8 * t * (1 - t)]); }
  for (let i = 0; i <= 4; i++) pt.push([x0 + 1.5 + ((x1 - x0 - 3) * i) / 4, yb]);
  for (let i = 4; i > 0; i--) for (let j = 0; j < 6; j++) { const t = j / 6; bot.push([pt[i][0] + (pt[i - 1][0] - pt[i][0]) * t, yb - 2.6 * Math.sin(Math.PI * t)]); }
  bot.push(pt[0]);
  S.add([top.concat(bot)], "#3ef2c0", 0, 0.12);   // (so it reads as one mass at 48 px)
  S.clipH = cvHull(top.concat([[x1 - 1.5, yb - 2.6], [x0 + 1.5, yb - 2.6]]));   // the mesh: diamonds, pitch 8 (above the scallops)
  const M = [];
  for (let c0 = -120; c0 <= 120; c0 += 8) M.push(cvBrush([[c0 - 70, -70], [c0 + 70, 70]], 1.3), cvBrush([[c0 - 70, 70], [c0 + 70, -70]], 1.3));
  S.add(M, "#3ef2c0", 0, 0.7);
  S.clipH = null;
  for (const q of pt) S.cel(cvCirc(q[0], q[1], 1.6), "#5a6a70", { lw: 1, sh: 0 });   // the lead weights
  S.add([cvBrush(top, 3.6)], "ink"); S.add([cvBrush(top, 2.2)], "#e6c98a");   // the rope, two cork floats
  for (const t of [3, 9]) S.cel(cvCirc(top[t][0], top[t][1], 2.6), "#ff7a6a", { lw: 1.4, sh: [0.9, -0.9], shade: cvSh("#ff7a6a") });
  // the starfish: coral, five arms (r 8), turned 0.3, five pale dots
  S.with(sx, sy, 0.3, sr / 8, () => {
    const P = [];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * CV_TAU - Math.PI / 2, r = i % 2 ? 2.6 : 8; P.push([Math.cos(a) * r, Math.sin(a) * r, i % 2 ? 0 : 1]); }
    S.cel(cvSm(P), "#ff7a6a", { lw: 1.8, sh: [1.2, -1.2], shade: cvSh("#ff7a6a") });
    S.add([0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * CV_TAU - Math.PI / 2; return cvCirc(Math.cos(a) * 4.3, Math.sin(a) * 4.3, 0.75); }), "#ffc2b8");
  });
  // the barnacles: three, a dark mouth in each
  for (const [dx, dy, r] of [[0, 0, 3], [4, 5, 2.3], [-2, 6, 2]]) {
    S.cel(cvCirc(bx + dx, by + dy, r), "#f6ecd0", { lw: 1.4, sh: [0.8, -0.8], shade: cvSh("#f6ecd0", 0.2) });
    S.fill(cvCirc(bx + dx, by + dy - r * 0.1, r * 0.4), "#3a3a3a");
  }
}
// Harvest Gold: an open wheat laurel on the head, four leaves a side pointing up along the wreath, a tie knot at each lower end
function skcLaurel(S, id) {
  const [cx, cy, rx, ry] = SKC_LAUREL[id], len = 8.5, w = 2.27;   // (the curve through +-w bulges to 3/4 of it: a leaf 3.4 wide)
  for (const s of [-1, 1]) {
    for (let k = 3; k >= 0; k--) {
      const a = -Math.PI / 2 + (s * (29 + 22 * k) * Math.PI) / 180, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      const ang = Math.atan2(-s * ry * Math.cos(a), s * rx * Math.sin(a));
      S.with(x, y, ang, 1, () => {
        S.cel(cvSm([[0, 0, 1], [len * 0.35, -w], [len, 0, 1], [len * 0.35, w]]), "#ffd23f", { lw: 1.4, sh: [0.6, -1], shade: cvSh("#ffd23f", 0.22) });
        S.line([[1, 0], [len * 0.8, 0]], 0.8, "#c98a1e");
      });
      if (k === 3) S.cel(cvCirc(x, y + 1, 2), "#c98a1e", { lw: 1.2, sh: 0 });
    }
  }
}
// Ink Noir: the disc, flat in the accent (no ink, no dark fill), paper dots on its lower-left third (pitch 4, r 0.4 to 1.4 at the edge)
function skcDiscCarve(S, D) {
  const [col, cx, cy, r] = D, dots = [], d0 = r * 0.27;
  S.fill(cvCirc(cx, cy, r), col);
  for (let j = 0, y = cy - r; y <= cy + r; j++, y = cy - r + j * 3.46) for (let x = cx - r + (j % 2) * 2; x <= cx + r; x += 4) {
    const d = (cx - x + (y - cy)) / Math.SQRT2;   // towards the lower left
    if (d < d0) continue;
    const rr = 0.4 + (d - d0) / (r - d0);
    if (Math.hypot(x - cx, y - cy) + rr < r - 0.6) dots.push(cvCirc(x, y, rr));
  }
  S.add(dots, SKC_PAPER);
}

/* ---- the passes (tests/pwpmskin.py times them through pmskPass) ---- */
// K.skinBack: behind the whole figure (the standing frame); K.skinFront: over all of it
// (only the skins with something there: a pass costs its transform even when it draws nothing)
const SKC_BACK = new Set(["c2", "c3", "scratch", "noir", "star"]), SKC_FRONT = new Set(["zorp", "kraken", "harvest", "star"]);
function skinBack(c, f, P, tk, flash, K) { if (K && !flash && SKC_BACK.has(skcKind(f))) pmskPass(skcBack, c, f, P, tk, K); }
function skinFront(c, f, P, tk, flash, K) { if (K && !flash && SKC_FRONT.has(skcKind(f))) pmskPass(skcFront, c, f, P, tk, K); }
function skcBack(c, f, P, tk, K) {
  const k = skcKind(f), id = K.fig.id;
  if (k === "c2" || k === "c3") return skcMotes(c, K, k === "c3");
  if (P.dim) c.globalAlpha *= 0.5;
  if (k === "scratch") {   // the tail, swaying +-0.12 rad about its root over 156 frames
    const R = SKC_ROAST[id];
    if (R && R[2]) { c.translate(R[2][0], R[2][1]); c.rotate(0.12 * Math.sin((tk * CV_TAU) / 156 + f.slot)); K.fit("skc-tail", skcTail); }
  } else if (k === "noir") skcDisc(c, K, tk);
  else if (k === "star") skcOrbit(c, K, tk, false);
}
function skcFront(c, f, P, tk, K) {
  const k = skcKind(f);
  if (P.dim) c.globalAlpha *= 0.5;
  if (k === "zorp") skcDome(c, K, tk);
  else if (k === "kraken") skcBubbles(c, K, tk);
  else if (k === "harvest") skcGlints(c, K, tk);
  else if (k === "star") skcOrbit(c, K, tk, true);
}
// the body slot (roadSkinBody with K; the body's lean, the rig frame): Devil's Roast's crack pulse (clipped like its cracks to the body-level
// parts' outline, skcClip, kept on the figure), Ink Noir's boiling line
function skcBody(c, f, P, tk, K) {
  const k = skcKind(f);
  if (k === "noir") return pmskBody(c, f, P, tk, K);
  if (k !== "scratch" || skcDrop(3)) return;
  c.save(); c.translate(0, P.cvDrop); c.clip(skcClip(K.fig, SKC_PARTS[K.fig.id] || ["body"]));
  if (P.dim) c.globalAlpha *= 0.5;
  const ga = c.globalAlpha;
  c.strokeStyle = "#ffe08a"; c.lineWidth = 1.1; c.lineCap = "round"; c.lineJoin = "round";
  for (let i = 0; i < 3; i++) {   // the three cores again, pulsing
    const C = skcCrack(K.fig, i);
    c.globalAlpha = ga * (0.5 + 0.5 * Math.sin(tk * 0.044 + 2.1 * i));
    c.beginPath(); c.moveTo(C[0][0], C[0][1]); for (let j = 1; j < C.length; j++) c.lineTo(C[j][0], C[j][1]); c.stroke();
  }
  c.restore();
}
// the top slot (roadSkinTop with K: after the hats, under the front arm; the body's lean, the rig frame)
function skcTop(c, f, P, tk, K) {
  const k = skcKind(f), id = K.fig.id;
  if (k === "noir") pmskTop(c, f, P, tk);   // today's speed ticks
  c.save(); c.translate(0, P.cvDrop);
  if (P.dim) c.globalAlpha *= 0.5;
  if (k === "scratch") { if (SKC_ROAST[id]) K.fit("skc-horns", (S) => skcHorns(S, id)); }
  else if (k === "kraken") { if (SKC_CATCH[id]) { skcKelp(c, K, tk); K.fit("skc-catch", (S) => skcCatchCarve(S, id)); } }
  else if (k === "harvest") { if (SKC_LAUREL[id]) K.fit("skc-laurel", (S) => skcLaurel(S, id)); }
  else if (k === "noir") {   // the accent wedge while he runs
    const D = SKC_DISC[id];
    if (D && f.state === "run") { c.beginPath(); c.moveTo(-46, -64); c.lineTo(-30, -68); c.lineTo(-31, -65); c.lineTo(-47, -61); c.closePath(); c.fillStyle = D[0]; c.fill(); }
  } else if (k === "star") skcTwinkle(c, K, tk);
  c.restore();
}

/* ---- layer 4: the live bits ---- */
// the chip skins' motes (150: three on the back column; 300: six on two columns, and two glints): they follow the fighter's place and
// facing, not the body's lean; not while dimmed
function skcMotes(c, K, top) {
  const P = K.P, M = SKC_MOTE[K.fig.id];
  if (!M || P.dim || skcDrop(3)) return;
  if (P.lean) { const h = P.hip; c.translate(0, -P.cvDrop); c.translate(h[0], h[1]); c.rotate(-P.lean); c.translate(-h[0], -h[1]); c.translate(0, P.cvDrop); }
  const n = top ? 6 : 3, tk = K.tk + K.f.slot * 37, ga = c.globalAlpha;
  c.fillStyle = top ? M[8] : M[7];
  for (let i = 0; i < n; i++) {   // each rises 12 over 200 frames, sways +-2, fades in and out; the phases 1/n apart
    const ph = (tk / 200 + i / n) % 1, a = Math.sin(Math.PI * ph);
    const x = M[0] + (top && i % 2 ? 7 : 0) + 2 * Math.sin(ph * CV_TAU + i), y = M[1] + ((M[2] - M[1]) * (i + 0.5)) / n - 12 * ph;
    c.globalAlpha = ga * a * 0.22; c.beginPath(); c.arc(x, y, 4, 0, CV_TAU); c.fill();
    c.globalAlpha = ga * a; c.beginPath(); c.arc(x, y, 1.6, 0, CV_TAU); c.fill();
  }
  c.globalAlpha = ga;
  if (!top) return;
  c.fillStyle = "#fff0c0";
  for (const [x, y, r, d] of [[M[3], M[4], 4, 0], [M[5], M[6], 2.8, 108]]) {   // a glint: 0 to full to 0 over 54 frames, once every 216
    const q = ((tk + 216 - d) % 216) / 54;
    if (q < 1) { c.beginPath(); pmskStar4(c, x, y, r * Math.sin(Math.PI * q)); c.fill(); }
  }
}
// Deep Catch: today's waving kelp strand, now from its root K (the wave runs down it, two blades off it)
function skcKelp(c, K, tk) {
  const C = SKC_CATCH[K.fig.id], f = K.f, x0 = C[3], y0 = C[4], L = 30, ph = tk * 0.09 + f.slot, sw = Math.sin(tk * 0.052 + f.slot) * 0.2, pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, dx = -t * L * 0.22 + Math.sin(t * 6 - ph) * 3 * t, dy = t * L;
    pts.push([x0 + dx * Math.cos(sw) - dy * Math.sin(sw), y0 + dx * Math.sin(sw) + dy * Math.cos(sw)]);
  }
  c.lineCap = "round"; c.lineJoin = "round";
  c.beginPath();
  for (const [i, s2] of [[4, -1], [7, 1]]) { const [bx, by] = pts[i]; c.moveTo(bx + s2 * 3.2 + 4.6, by + 1.5); c.ellipse(bx + s2 * 3.2, by + 1.5, 4.6, 1.7, s2 * 0.7 + sw + Math.sin(ph + i) * 0.15, 0, CV_TAU); }
  c.fillStyle = "#2f8a5a"; c.fill(); c.strokeStyle = CV_INK; c.lineWidth = 1; c.stroke();
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.lineWidth = 5.4; c.stroke();
  c.strokeStyle = "#2f8a5a"; c.lineWidth = 3.6; c.stroke();
  c.strokeStyle = "#5fbf7f"; c.lineWidth = 1.1; c.beginPath(); c.moveTo(pts[1][0], pts[1][1]); for (let i = 2; i < 9; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
}
// Deep Catch: three bubbles (rings) rising 30 over 180 frames, a third of a cycle apart, growing 20 %
function skcBubbles(c, K, tk) {
  const C = SKC_CATCH[K.fig.id], M = K.fig.mouthPt;
  if (!C || skcDrop(2)) return;
  const ga = c.globalAlpha;
  c.strokeStyle = "#c8fff5"; c.lineWidth = 1.2;
  [[M[0] + 12, M[1] - 10, 3], [C[3] - 6, C[4] - 8, 2], [M[0] + 18, M[1] - 24, 2.4]].forEach(([x, y, r], i) => {
    const q = (tk / 180 + i / 3) % 1;
    c.globalAlpha = ga * 0.9 * Math.min(1, q * 8, (1 - q) * 6);
    c.beginPath(); c.arc(x + Math.sin(q * 9 + i) * 1.2, y - 30 * q, r * (1 + 0.2 * q), 0, CV_TAU); c.stroke();
  });
  c.globalAlpha = ga;
}
// Specimen: the dome (a fitting, in front of everything), the slime bead sliding down the glass and back, the three motes orbiting inside
function skcDome(c, K, tk) {
  const id = K.fig.id;
  if (!SKC_DOME[id]) return;
  K.fit("skc-dome", (S) => skcDomeCarve(S, id));
  if (skcDrop(2)) return;
  const D = skcBell(id), q = 0.5 - 0.5 * Math.cos(((tk + K.f.slot * 60) / 240) * CV_TAU), bx = D.x + D.rx * 0.05, y0 = D.yc + 15.5, y = y0 + (D.ap + D.hh * 0.7 - y0) * q;
  c.beginPath(); c.moveTo(bx + 1.8, y); c.arc(bx, y, 1.8, 0, CV_TAU);
  for (let i = 0; i < 3; i++) { const a = tk * 0.0524 + i * 2.094, mx = D.x + Math.cos(a) * D.rx * 0.6, my = D.by - D.hh * 0.5 + Math.sin(a) * D.hh * 0.22; c.moveTo(mx + 1.1, my); c.arc(mx, my, 1.1, 0, CV_TAU); }
  c.fillStyle = "#9dff5a"; c.fill();
}
// Harvest Gold: five glints on and round the body lighting in turn (40 frames each of a 150-frame round: two at once at most)
function skcGlints(c, K, tk) {
  const B = K.fig.body, t = (tk + K.f.slot * 75) % 150;
  c.beginPath();
  SKC_GLINT.forEach(([u, v, r], i) => { const q = ((t - i * 30 + 150) % 150) / 40; if (q < 1) pmskStar4(c, B.x + u * B.rx, B.y + v * B.ry, r * Math.sin(Math.PI * q)); });
  c.fillStyle = "#fff3b0"; c.fill();
}
// Ink Noir: the disc behind the figure (a fitting, at 0.9) and four ink drops on its back edge, bobbing
function skcDisc(c, K, tk) {
  const D = SKC_DISC[K.fig.id];
  if (!D) return;
  const ga = c.globalAlpha;
  c.globalAlpha = ga * 0.9; K.fit("skc-disc", (S) => skcDiscCarve(S, D)); c.globalAlpha = ga;
  if (skcDrop(1)) return;
  c.beginPath();
  [[-150, 1.5], [-175, 2], [160, 2.6], [135, 3.4]].forEach(([a, r], i) => {
    const x = D[1] + Math.cos((a * Math.PI) / 180) * D[3], y = D[2] + Math.sin((a * Math.PI) / 180) * D[3] + 1.5 * Math.sin(((tk + K.f.slot * 30) / 120) * CV_TAU + i * 1.6);
    c.moveTo(x + r, y); c.arc(x, y, r, 0, CV_TAU);
  });
  c.fillStyle = SKC_INK; c.fill();
}
// Starfall: the orbit ring round the figure (its far half behind it, the near half in front), the comet on it once every 192 frames (behind
// on the far half), and behind the figure three outer stars twinkling in turn
function skcOrbit(c, K, tk, near) {
  const B = K.fig.body, rx = B.rx + 22, ry = 13, tl = -0.3, cs = Math.cos(tl), sn = Math.sin(tl), ga = c.globalAlpha;
  c.globalAlpha = ga * 0.75; c.strokeStyle = "#c9a6ff"; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(B.x, B.y, rx, ry, tl, near ? 0 : Math.PI, near ? Math.PI : CV_TAU); c.stroke();
  const th0 = ((tk + K.f.slot * 96) / 192) * CV_TAU;
  for (let i = 3; i >= 0; i--) {
    const th = th0 - i * 0.16;
    if (Math.sin(th) > 0 !== near) continue;
    const ex = Math.cos(th) * rx, ey = Math.sin(th) * ry, x = B.x + ex * cs - ey * sn, y = B.y + ex * sn + ey * cs;
    if (!i) { c.globalAlpha = ga * 0.35; c.fillStyle = "#ff6ad5"; c.beginPath(); c.arc(x, y, 9, 0, CV_TAU); c.fill(); }
    c.globalAlpha = ga * (i ? 0.5 - i * 0.12 : 1); c.fillStyle = i ? "#ffb0e0" : "#fff6d8";
    c.beginPath(); pmskStar4(c, x, y, 6 * (1 - i * 0.2)); c.fill();
  }
  c.globalAlpha = ga;
  if (near || skcDrop(1)) return;
  [[-34, -70, 3.4, "#fff6d8"], [30, -84, 2.6, "#ffb0e0"], [38, -30, 2.2, "#fff6d8"]].forEach(([x, y, r, col], i) => {
    const tw = Math.max(0, Math.sin(((tk + K.f.slot * 40) / 150) * CV_TAU - i * 2.1));
    c.fillStyle = col; c.beginPath(); pmskStar4(c, x, y, r * (0.45 + 0.55 * tw)); c.fill();
  });
}
// Starfall: four of the seven twinkling stars (PMSK_STARS rows 0, 2, 4, 5; one that would sit on the face gives way to the next row), over
// the costume too
function skcTwinkle(c, K, tk) {
  const fig = K.fig, B = fig.body, ga = c.globalAlpha;
  let pl = fig.skcTw;
  if (!pl) {
    pl = fig.skcTw = [];
    for (const i of [0, 2, 4, 5, 1, 3, 6]) { const [x, y, sz, per, ph] = PMSK_STARS[i], X = B.x + x * B.rx, Y = B.y + y * B.ry; if (pl.length < 4 && !skcOnFace(fig, X, Y, 2)) pl.push([X, Y, sz, per, ph]); }
  }
  c.fillStyle = "#ffc8ef";
  for (const [x, y, sz, per, ph] of pl) {
    const tw = Math.max(0, Math.sin((tk / per) * CV_TAU + ph));
    c.globalAlpha = ga * (0.35 + 0.65 * tw * tw); c.beginPath(); pmskStar4(c, x, y, sz * 1.3 * (1 + 0.6 * tw)); c.fill();
  }
  c.globalAlpha = ga;
}
// a Pommes skin's heavy-hit fleck (a hit for which the hit kit plays its heavy panel, hkTier >= 2): particles off the hit point in a fan away
// from the victim, on top of the hit's own spark. Ink Noir: four ink blots and one accent blot (100 degrees, 16 frames); Starfall: five star
// sparks and one pink streak (120 degrees, 18 frames)
function skcFleck(g, f, e) {
  const d = g.fighters[e.def];
  if (!d) return;
  const a0 = Math.atan2(e.y - (d.y - d.s.h * 0.5), e.x - d.x);
  if (skinPm(f) === 1) {
    for (let i = 0; i < 5; i++) {
      const a = a0 + ((i / 4 - 0.5) * 100 * Math.PI) / 180 + rnd(-0.1, 0.1), v = rnd(2, 3.6);
      addFx({ k: "pmsk-ink", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: i === 2 ? 3 : rnd(2, 4), col: i === 2 ? f.pal.accent : SKC_INK, t: 0, life: 16, damp: 0.88 });
    }
    return;
  }
  for (let i = 0; i < 5; i++) {
    const a = a0 + ((i / 4 - 0.5) * 120 * Math.PI) / 180 + rnd(-0.1, 0.1), v = rnd(2.2, 3.8);
    addFx({ k: "pmsk-spark", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(2.5, 4), col: i % 2 ? "#c9a6ff" : "#ffb3ec", t: 0, life: 18, damp: 0.9, ph: i });
  }
  addFx({ k: "pmsk-ray", x: e.x + Math.cos(a0) * 8, y: e.y + Math.sin(a0) * 8, vx: Math.cos(a0) * 3.4, vy: Math.sin(a0) * 3.4, ang: a0, len: 20, w: 2, col: "#ff6ad5", t: 0, life: 18, damp: 0.9 });
}

/* ---- Pommes skins: two lines laid on any fighter, bought with Pommes (pal.pommes: 1 Ink Noir, 2 Starfall; Fable, step8/fable-design-2.md
   section 2), UI only ----
   The Road skins' two passes, dispatched from roadSkinBody / roadSkinTop: pmskBody inside the body's lean clipped to the potato (before the
   face), pmskTop after the hats. Decoration only: nothing on a hit flash, no white fills, no blue glows (the night sky keeps to pink and
   violet), no gold rings. Per fighter per frame at most one cached image and twelve small shapes; the halftone is drawn once per fighter
   into a canvas, the nebula's gradient once per canvas. The shapes on the body move with the tick alone (no randomness), so a still of a
   skin is always the same. Sizes are Fable's at a 100 px fighter, scaled by rx / 25 (k). Ink Noir's costumes drop their fixed colours for
   two inks (ui/draw-fighters.js noirOn). */
const skinPm = (f) => (f && f.pal && f.pal.pommes) || 0;
// what each Pommes line does (the select screen and the Skin Rack)
const PMFX = { 1: _t("Inked like a manga page: halftone shading, a boiling outline, ink strokes on dashes and hits and an inked KO"),
  2: _t("A night sky inside: a breathing nebula, twinkling stars, a comet in orbit, stardust and a starburst on every KO") };
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
const pmskCache = new WeakMap(), pmskTone = new WeakMap();
// the nebula's gradient, once per canvas context (a CanvasGradient belongs to its context)
function pmskRes(c) {
  let R = pmskCache.get(c);
  if (R) return R;
  const neb = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  neb.addColorStop(0, "#ff4fd8"); neb.addColorStop(0.5, "rgba(122,75,255,0.7)"); neb.addColorStop(1, "rgba(122,75,255,0)");
  R = { neb };
  pmskCache.set(c, R);
  return R;
}
// Ink Noir's screen tone: a halftone gradient on a 45 degree grid (pitch 4.5), the dots r 0.5 at its top edge (sh: share of the potato's
// height below its top) growing to r 1.5 at the potato's bottom. Drawn once per fighter into a canvas of the tone's box (x +-1.2 rx, from the
// top edge to 0.1 ry under the potato), in ink at full strength (the pass lays it at 0.55); drawn again only when the zoom crosses a
// half-octave (the canvas keeps at least one of its pixels per screen pixel) or the fighter's look changes. Returns { cv, hk: box h / ry, ... }
function pmskToneCv(c, f, P, sh) {
  const { rx, ry } = P, m = c.getTransform(), zs = Math.hypot(m.a, m.b);
  const q = Math.pow(2, Math.ceil(Math.log2(Math.max(1, zs)) * 2) / 2);   // canvas pixels per unit
  const hk = 2.1 - 2 * sh;
  let T = pmskTone.get(f);
  if (T && T.q === q && T.sh === sh && Math.abs(T.rx - rx) < rx * 0.15 && Math.abs(T.ry - ry) < ry * 0.15) return T;
  const k = rx / 25, W = rx * 2.4, H = ry * hk, bot = ry * (2 - 2 * sh), p = 4.5 * k, dy = p * Math.SQRT1_2, dx = p * Math.SQRT2;
  const cv = (T && T.cv) || document.createElement("canvas");
  cv.width = Math.ceil(W * q); cv.height = Math.ceil(H * q);
  const x = cv.getContext("2d");
  x.clearRect(0, 0, cv.width, cv.height); x.scale(q, q); x.fillStyle = PMSK_INK; x.beginPath();
  for (let j = 0, y = dy * 0.5; y < H + p; j++, y += dy) {
    const r = (0.5 + Math.min(1, y / bot)) * k;
    for (let xx = (j % 2) * dx * 0.5; xx < W + p; xx += dx) { x.moveTo(xx + r, y); x.arc(xx, y, r, 0, PMSK_TAU); }
  }
  x.fill();
  T = { cv, q, sh, rx, ry, hk };
  pmskTone.set(f, T);
  return T;
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
// a sharp four-point star (Starfall's KO sparks): straight arms, the inner corners at a third of r
function pmskSpark4(c, x, y, r) {
  const n = r * 0.24;
  c.moveTo(x, y - r); c.lineTo(x + n, y - n); c.lineTo(x + r, y); c.lineTo(x + n, y + n);
  c.lineTo(x, y + r); c.lineTo(x - n, y + n); c.lineTo(x - r, y); c.lineTo(x - n, y - n); c.closePath();
}
// tests/pwpmskin.py times the skin passes (the Pommes skins' two; on a carved figure every pass of a skin: skinBack, the body and top slots,
// skinFront): it sets window.__pmskProf = { now, flush, add(slot, ms, readMs) } (never set in play). With flush
// a 1 px read before and after the pass makes the canvas draw what was queued, so the pass's raster is counted; a third read with nothing
// queued measures the read itself (readMs)
function pmskPass(fn, c, f, P, tk, K) {
  const pr = window.__pmskProf;
  if (!pr) return fn(c, f, P, tk, K);
  const fl = () => { if (pr.flush) try { c.getImageData(0, 0, 1, 1); } catch (e) { pr.flush = false; } };
  fl(); const t0 = pr.now();
  fn(c, f, P, tk, K); fl();
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
function pmskBody(c, f, P, tk, K) {
  const pm = skinPm(f), { rx, ry, cy } = P, k = rx / 25, cos = f.spec.look.costume;
  c.save(); potatoPath(c, P); c.clip();
  if (P.dim) c.globalAlpha = 0.5;
  const a0 = c.globalAlpha;
  if (pm === 1) {
    // the screen tone: the fighter's cached halftone laid on the body under the face (it squashes and leans with the body)
    // (on a carved figure the halftone is atop paint, skcShapes, baked into its sprites)
    if (!K) { const sh = PMSK_DOTS[cos] || 0.45, T = pmskToneCv(c, f, P, sh); c.globalAlpha = a0 * 0.55; c.drawImage(T.cv, -rx * 1.2, cy - ry + sh * ry * 2, rx * 2.4, ry * T.hk); }
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
  const R = pmskRes(c), nr = ry * 0.9, nx = -rx * 0.38, ny = cy - ry * 0.4 + (cos === "alchemist" || cos === "reaper" ? ry * 0.15 : 0);
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
  // the rim light: a pink line just inside the outline along the top of the potato (-150 to -30 degrees, potatoPath's own curve), so the dark
  // body stands off a dark stage
  const d = 1.25 + 0.75 * k;   // its outer edge on the inner edge of the 2.5 px outline
  c.globalAlpha = a0 * 0.35; c.strokeStyle = "#ff6ad5"; c.lineWidth = 1.5 * k; c.lineCap = "round"; c.lineJoin = "round";
  c.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (-150 + i * 10) * (Math.PI / 180), bump = 1 + 0.025 * Math.sin(a * 4 + 0.7) + 0.015 * Math.sin(a * 7 + 2);
    const x = Math.cos(a) * rx * bump * (1 + 0.07 * Math.sin(a)), y = Math.sin(a) * ry * bump, s = 1 - d / Math.hypot(x, y);
    if (i) c.lineTo(x * s, cy + y * s); else c.moveTo(x * s, cy + y * s);
  }
  c.stroke();
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
    // the dash: five ink strokes behind (2 px, 24-40 px, ink at 0.55, 120 ms), again every 4 frames of the burst, at most ten alive
    if (dash && f.spr % 4 === 1) {
      const n = Math.min(5, 10 - pmskCount(slot, "d"));
      for (let i = 0; i < n; i++) addFx({ k: "pmsk-ray", x: f.x - fc * (w * 0.42 + rnd(0, 10)), y: f.y - h * (0.1 + 0.18 * i + rnd(0, 0.08)), vx: -fc * rnd(0.6, 1.4), vy: 0,
        ang: fc > 0 ? 0 : Math.PI, len: rnd(24, 40) * k, w: 2 * k, col: PMSK_INK, al: 0.55, t: 0, life: 7, damp: 0.9, pmsk: slot, pmT: "d" });
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
    // a magenta ring (never gold, 3 px, fading over its 20 frames), six pink streaks flying out (30 px, 2 px, 400 ms) and eighteen star sparks
    addFx({ k: "pmsk-ring", x, y, t: 0, life: 20, r0: 10 * kk, r1: 50 * kk, lw: 3 * kk, col: "#ff4fd8" });
    const a6 = rnd(0, PMSK_TAU / 6);
    for (let i = 0; i < 6; i++) { const a = a6 + (i / 6) * PMSK_TAU, v = rnd(3.2, 3.8); addFx({ k: "pmsk-ray", x: x + Math.cos(a) * 22 * kk, y: y + Math.sin(a) * 22 * kk, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ang: a, len: 30 * kk, w: 2 * kk, col: "#ff6ad5", t: 0, life: 24, damp: 0.92 }); }
    for (let i = 0; i < 18; i++) { const a = (i / 18) * PMSK_TAU + rnd(-0.12, 0.12), v = rnd(1, 2.4); addFx({ k: "pmsk-spark", x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.3, r: rnd(2.5, 3.5) * kk, col: i % 2 ? "#ffb3ec" : "#c9a6ff", t: 0, life: 36, damp: 0.96, ph: i }); }
    // the comet leaves its orbit (skcOrbit): from the front of the ring, 60 up and out over 24 frames, four copies trailing
    const fig = CV_FIG[k.spec.look.costume], B = fig ? fig.body : { x: 0, y: -k.s.h * 0.45, rx: k.s.w * 0.4 }, fc = k.facing;
    addFx({ k: "pmsk-comet", x: k.x + fc * (B.x + B.rx + 14), y: k.y + B.y - 4, dx: fc * 30, dy: -52, t: 0, life: 24 });
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
    case "pmsk-ray": {   // a straight stroke (Ink Noir's dash, Starfall's KO streaks): its head at (x, y), its tail len behind along ang; it holds its
      // alpha (al) through the first half of its life, then fades
      const cs = Math.cos(e.ang), sn = Math.sin(e.ang);
      c.globalAlpha = (e.al || 1) * Math.min(1, a * 2); c.strokeStyle = e.col; c.lineWidth = e.w; c.lineCap = "round";
      c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x - cs * e.len, e.y - sn * e.len); c.stroke();
      return true;
    }
    case "pmsk-ring": {   // Starfall's KO ring: r0 -> r1 (fast out, slowing), lw wide, alpha 1 -> 0 over its life
      const q = e.t / e.life;
      c.globalAlpha = a; c.strokeStyle = e.col; c.lineWidth = e.lw;
      c.beginPath(); c.arc(e.x, e.y, lerp(e.r0, e.r1, 1 - (1 - q) * (1 - q)), 0, PMSK_TAU); c.stroke();
      return true;
    }
    case "pmsk-comet": {   // Starfall's KO: the comet flying off (x, y the start, dx, dy the flight), a pink glow, four copies behind
      const q = e.t / e.life, at = (u) => 1 - (1 - u) * (1 - u), r = 10 * (1 - 0.35 * q);
      for (let i = 4; i >= 0; i--) {
        const u = at(Math.max(0, q - i * 0.07)), x = e.x + e.dx * u, y = e.y + e.dy * u;
        if (!i) { c.globalAlpha = a * 0.35; c.fillStyle = "#ff6ad5"; c.beginPath(); c.arc(x, y, r * 1.4, 0, PMSK_TAU); c.fill(); }
        c.globalAlpha = a * (i ? 0.5 - i * 0.1 : 1); c.fillStyle = i ? "#ffb0e0" : "#fff6d8"; c.beginPath(); pmskStar4(c, x, y, r * (1 - i * 0.16)); c.fill();
      }
      return true;
    }
    case "pmsk-spark": {   // Starfall's KO: a sharp four-point star (r 2.5-3.5) that twinkles as it flies, on a larger magenta star (so it reads on a pale sky)
      const tw = 0.7 + 0.3 * Math.abs(Math.sin(e.t * 0.35 + e.ph)), r = e.r * (0.85 + 0.15 * tw);
      c.globalAlpha = a * 0.35; c.fillStyle = "#ff4fd8"; c.beginPath(); pmskSpark4(c, e.x, e.y, r * 1.7); c.fill();
      c.globalAlpha = a * tw; c.fillStyle = e.col; c.beginPath(); pmskSpark4(c, e.x, e.y, r); c.fill();
      return true;
    }
  }
  return false;
}
