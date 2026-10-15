/* ===================== Bosses: Old Scratch's drawing, his fire, his tells on the floor, his sounds (UI only) =====================
   The simulation (core.js BOSSES, bossAct/bossStep/bossHit) never reads anything here. Hooks: drawFighter (draw-fighters.js) hands a
   boss to drawBoss, drawProj (draw-world.js) offers every projectile to drawBossProj first, render2D (effects.js) calls bossFloor after
   the stage, handleEvent (effects.js) passes every event to bossEvent. */
// placeholder until the art lands: a red potato 2.5x the roster's size
function drawBoss(c, f, tk, at) {
  const hw = f.s.w / 2, h = f.s.h, x = at ? at[0] : f.x, y = at ? at[1] : f.y;
  c.save();
  c.fillStyle = f.state === "broken" ? "#8a2a1a" : "#b8402e"; c.strokeStyle = OUT; c.lineWidth = 4;
  c.beginPath(); c.ellipse(x, y - h / 2, hw, h / 2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
}
function drawBossProj(c, p, tk) {
  if (p.style !== "flame" && p.style !== "brim" && p.style !== "trail") return false;
  c.fillStyle = "#ff7a2b"; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
  return true;
}
function bossFloor(c, g, tk) {}
function bossEvent(g, e, live) {}
