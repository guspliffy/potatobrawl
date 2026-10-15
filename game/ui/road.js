/* ===================== The Road, region 1: The Field (Fable's design: boss/fable-boss.md section 3) =====================
   Eight stops, each a 1v1 against a named CPU with one twist rule; three stars each: the win, no heart lost, the stop's bonus.
   Stop k opens when stop k-1 is won. 12 of the 24 stars open the fence: Old Scratch (ui/boss.js) on Normal / Hard / Nightmare, a
   star each; the first win pays the Devil Masher title and 150 chips. Each new star pays 10 chips. Progress: P.road = { s: the stars
   per stop as bits (1 win, 2 no heart lost, 4 bonus), b: boss levels won as bits, paid } (sync.js merges it: every star either device
   won stays won). The map is drawn on a canvas (roadDraw); the stops are buttons laid over it. UI only: the twists are newGame
   options (lives, start percent, the percent every life starts at, the time, the map). */
const ROAD = [
  { id: "gate", name: "The Farm Gate", cpu: "Small Fry", f: "phoenix", d: 0.3, lives: 2, secs: 90, map: "field",
    line: "Gate's open. Mind the sprouts, they bite.", bonus: { k: "fast", s: 60, txt: "Win in under 60 s" } },
  { id: "sprout", name: "The Sprout Patch", cpu: "Mash", f: "odin", d: 0.4, secs: 120, map: "field", cpuPct: 70, twist: "Mash starts at 70%.",
    line: "Nobody moves Mash. Nobody.", bonus: { k: "route", r: "three", txt: "Land the Three-piece combo" } },
  { id: "scarecrow", name: "The Scarecrow's Post", cpu: "Straw Jack", f: "reaper", d: 0.45, secs: 120, map: "field", myLifePct: 40, twist: "You start every life at 40%.",
    line: "Caw. Just a scarecrow. Nothing with a scythe here.", bonus: { k: "fin", txt: "KO with a finisher special" } },
  { id: "well", name: "The Lord's Well", cpu: "Dr. Peel", f: "alchemist", d: 0.5, secs: 90, map: "castle", twist: "Win inside 90 seconds.",
    line: "Drink this. No? Then I'll throw it.", bonus: { k: "route", r: "lift", txt: "Land the Lift & Smash combo" } },
  { id: "crow", name: "Crow's Rest", cpu: "Bang Bang Maris", f: "gunslinger", d: 0.6, lives: 1, secs: 60, map: "field", twist: "One life each.",
    line: "One heart. One shot. Don't blink.", bonus: { k: "ulti", txt: "KO with an ulti" } },
  { id: "barn", name: "The Burnt Barn", cpu: "Cinder", f: "dragon", d: 0.65, map: "fryer", myPct: 50, twist: "You start at 50%.",
    line: "Smell that? That's you, in a minute.", bonus: { k: "route", r: "trip", txt: "Land the Trip & Spike combo" } },
  { id: "moon", name: "The Harvest Moon", cpu: "Moonie", f: "wizard", d: 0.75, map: "moon", lives: 2, cpuLives: 3, twist: "Moonie has 3 hearts, you have 2.",
    line: "The stars said you'd come. They were vague about the leaving.", bonus: { k: "ulti", txt: "KO with an ulti" } },
  { id: "edge", name: "The Field's Edge", cpu: "Sir Spudsalot", f: "samurai", d: 0.85, lives: 2, map: "field", cpuPct: 25, twist: "Sir Spudsalot starts at 25%.",
    line: "He's behind the fence. First, me.", bonus: { k: "fast", s: 120, txt: "Win in under 2 minutes" } },
];
const ROAD_GATE = 12, ROAD_STAR_CHIPS = 10, ROAD_BOSS_CHIPS = 150, ROAD_BOSS = "scratch";
const ROAD_STARS = ["Win", "No heart lost"];
function roadGet() { return SYNC.cleanRoad(P.road) || { s: [], b: 0, paid: false }; }
const roadBits = (r, i) => r.s[i] | 0;
const roadNStars = (bits) => (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
const roadTotal = (r) => ROAD.reduce((a, _, i) => a + roadNStars(roadBits(r, i)), 0);
const roadBossStars = (r) => roadNStars(r.b);
const roadOpen = (r, i) => i === 0 || (roadBits(r, i - 1) & 1) === 1;   // a stop opens when the one before it is won
const roadNext = (r) => { const i = ROAD.findIndex((_, k) => !(roadBits(r, k) & 1)); return i < 0 ? ROAD.length : i; };   // 8 = every stop won
const roadGateOpen = (r) => roadTotal(r) >= ROAD_GATE;
const roadLives = (st) => [st.lives || 3, st.cpuLives || st.lives || 3];
const roadSecs = (st) => st.secs || 180;
const mmssR = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
// the stop's rules in one line: the twist in bold, then lives, time, map
function roadRules(st) {
  const [a, b] = roadLives(st), lives = a === b ? `${a} ${a === 1 ? "life" : "lives"} each` : `${a} lives vs ${b}`;
  const mi = BL.MAPS.findIndex((m) => m.id === st.map);
  return { twist: st.twist || "", rest: `${lives} · ${mmssR(roadSecs(st))} · ${mapName(Math.max(0, mi))}` };
}
// "Stop 3 of 8 · 7 ★" (every stop won: "Old Scratch · 7 ★")
function roadSummary(r) {
  const n = roadNext(r), t = roadTotal(r) + roadBossStars(r);
  return `${n < ROAD.length ? `Stop ${n + 1} of ${ROAD.length}` : roadGateOpen(r) ? "Old Scratch" : `${ROAD_GATE} ★ open the fence`} · ${t} ★`;
}

/* ----- the map: a dirt path from the gate (bottom left) to the fence gap (top right) across the night field ----- */
// stop positions as fractions of the map (wide screens, then upright ones); the last point is the fence gap (the boss)
const RD_WIDE = [[0.12, 0.76], [0.26, 0.86], [0.38, 0.68], [0.25, 0.5], [0.41, 0.36], [0.57, 0.5], [0.71, 0.64], [0.8, 0.43], [0.9, 0.2]];
const RD_TALL = [[0.24, 0.87], [0.6, 0.85], [0.8, 0.72], [0.5, 0.63], [0.2, 0.55], [0.36, 0.44], [0.7, 0.4], [0.56, 0.28], [0.76, 0.13]];
const RD_GATE = { wide: [0.03, 0.9], tall: [0.06, 0.95] };
const RD = { cv: null, bg: null, key: "", hop: -1, hopT: 0, pup: null, pupId: "", pts: [], R: 20, w: 0, h: 0, sel: -1,
  pos: null, home: null, walk: null, dust: [] };   // pos: the stop your fighter stands on (a fraction while walking); walk: { a, b, t0, ms, ph, then }
function rdPoints(w, h) {
  const tall = h > w * 1.05, P0 = tall ? RD_TALL : RD_WIDE, g = RD_GATE[tall ? "tall" : "wide"];
  const mx = Math.min(w, h) * 0.04, my = mx;
  const at = ([x, y]) => [mx + x * (w - 2 * mx), my + y * (h - 2 * my)];
  return { gate: at(g), pts: P0.map(at), tall };
}
// a point on the drawn path below: s runs 0 (the gate) .. all.length - 1, stop i sits at s = i + 1
function rdCurve(all, s) {
  const i = clamp(Math.floor(s), 0, all.length - 2), t = clamp(s - i, 0, 1);
  const p0 = all[Math.max(0, i - 1)], p1 = all[i], p2 = all[i + 1], p3 = all[Math.min(all.length - 1, i + 2)];
  const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p1[0] + b * c1[0] + c * c2[0] + d * p2[0], a * p1[1] + b * c1[1] + c * c2[1] + d * p2[1]];
}
// a smooth path through the points (Catmull-Rom as Béziers)
function rdPath(c, pts) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}
function rdStar(c, x, y, r, fill, line) {
  c.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.46 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = Math.max(1.2, r * 0.22); c.strokeStyle = line; c.lineJoin = "round"; c.stroke();
}
// the still part (sky, moon, hills, field, path, fence), cached per size and progress
function rdBackground(w, h, s, r) {
  const cv = document.createElement("canvas"); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
  const c = cv.getContext("2d"); c.scale(s, s);
  const { gate, pts, tall } = rdPoints(w, h), u = Math.min(w, h), hz = h * (tall ? 0.2 : 0.3);
  // sky and stars
  const sk = c.createLinearGradient(0, 0, 0, hz); sk.addColorStop(0, "#1a0f2a"); sk.addColorStop(0.55, "#4a1a3a"); sk.addColorStop(1, "#8c2a2e");
  c.fillStyle = sk; c.fillRect(0, 0, w, hz + 2);
  c.fillStyle = "rgba(255,220,200,0.6)";
  for (let i = 0; i < 26; i++) { const x = ((i * 137.5) % 100) / 100 * w, y = ((i * 61.3) % 100) / 100 * hz * 0.7; c.beginPath(); c.arc(x, y, 0.7 + (i % 3) * 0.35, 0, Math.PI * 2); c.fill(); }
  // the harvest moon, top left
  const mr = u * 0.085, mx = w * (tall ? 0.2 : 0.14), my = hz * 0.45;
  const gl = c.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.6); gl.addColorStop(0, "rgba(255,110,60,0.35)"); gl.addColorStop(1, "rgba(255,110,60,0)");
  c.fillStyle = gl; c.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
  c.fillStyle = "#ff6a3a"; c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#d94f2a"; for (const [dx, dy, k] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.38, 0.12]]) { c.beginPath(); c.arc(mx + dx * mr, my + dy * mr, k * mr, 0, Math.PI * 2); c.fill(); }
  // far hills on the horizon, the farmhouse on the right one
  c.fillStyle = "#2a1430";
  c.beginPath(); c.moveTo(0, hz + 2); c.quadraticCurveTo(w * 0.22, hz - u * 0.12, w * 0.46, hz + 2); c.quadraticCurveTo(w * 0.72, hz - u * 0.16, w, hz - u * 0.02); c.lineTo(w, hz + 4); c.lineTo(0, hz + 4); c.fill();
  // the field: soil with furrows and sprouts
  const fg = c.createLinearGradient(0, hz, 0, h); fg.addColorStop(0, "#3a2014"); fg.addColorStop(0.35, "#5a3421"); fg.addColorStop(1, "#3a2014");
  c.fillStyle = fg; c.fillRect(0, hz, w, h - hz);
  c.lineWidth = 2; c.strokeStyle = "rgba(122,74,46,0.55)";
  for (let k = 1; k <= 7; k++) {
    const y = hz + (h - hz) * (k * k) / 56; c.beginPath();
    for (let x = 0; x <= w; x += 24) c.lineTo(x, y + Math.sin(x * 0.05 + k) * 2);
    c.stroke();
  }
  c.fillStyle = "#5a8a3a";
  for (let i = 0; i < 40; i++) { const x = ((i * 83.1) % 100) / 100 * w, y = hz + 10 + ((i * 47.7) % 100) / 100 * (h - hz - 14); c.beginPath(); c.ellipse(x - 2, y, 3, 1.4, -0.5, 0, Math.PI * 2); c.ellipse(x + 2, y, 3, 1.4, 0.5, 0, Math.PI * 2); c.fill(); }
  // the dirt path, from the gate through the stops to the fence gap
  const all = [gate, ...pts];
  c.lineCap = "round"; c.lineJoin = "round";
  rdPath(c, all); c.strokeStyle = "#2a1a16"; c.lineWidth = u * 0.075; c.stroke();
  rdPath(c, all); c.strokeStyle = "#7a4a2e"; c.lineWidth = u * 0.06; c.stroke();
  rdPath(c, all); c.setLineDash([u * 0.012, u * 0.03]); c.strokeStyle = "#a0683e"; c.lineWidth = u * 0.012; c.stroke(); c.setLineDash([]);
  // the farm gate at the start: two posts with a sign across them, the gate swung open toward you
  const [gx, gy] = gate, ph = u * 0.1, x0 = gx - u * 0.035, x1 = gx + u * 0.055;
  c.strokeStyle = OUT; c.lineWidth = 2; c.fillStyle = "#7a4a2e";
  c.beginPath(); c.moveTo(x1, gy - ph * 0.72); c.lineTo(x1 + u * 0.06, gy - ph * 0.5); c.lineTo(x1 + u * 0.06, gy - ph * 0.08); c.lineTo(x1, gy - ph * 0.2); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(x1, gy - ph * 0.46); c.lineTo(x1 + u * 0.06, gy - ph * 0.29); c.stroke();
  c.fillStyle = "#e8d8a8";
  for (const x of [x0, x1]) { c.beginPath(); c.rect(x - 3, gy - ph, 6, ph); c.fill(); c.stroke(); }
  c.fillStyle = "#a0683e"; c.beginPath(); c.rect(x0 - 5, gy - ph - 2, x1 - x0 + 10, 6); c.fill(); c.stroke();
  // the fence across the top right with a gap at the boss's spot; a hill beyond it
  const [bx, by] = pts[pts.length - 1], fy = by + u * 0.02;
  c.fillStyle = "#1e0f22"; c.beginPath(); c.ellipse(bx + u * 0.02, by - u * 0.1, u * 0.26, u * 0.12, 0, Math.PI, Math.PI * 2); c.fill();
  c.strokeStyle = OUT; c.lineWidth = 2.5; c.fillStyle = "#7a4a2e";
  const open = roadGateOpen(r), gap = u * 0.07;
  for (const side of [-1, 1]) {
    const x0 = bx + side * gap, x1 = side < 0 ? Math.max(0, bx - u * 0.42) : Math.min(w, bx + u * 0.42);
    for (let x = x0; side < 0 ? x > x1 : x < x1; x += side * u * 0.055) { c.beginPath(); c.rect(x - 3, fy - u * 0.07, 6, u * 0.075); c.fill(); c.stroke(); }
    c.beginPath(); c.rect(Math.min(x0, x1), fy - u * 0.055, Math.abs(x1 - x0), 4); c.fill(); c.stroke();
    c.beginPath(); c.rect(Math.min(x0, x1), fy - u * 0.025, Math.abs(x1 - x0), 4); c.fill(); c.stroke();
  }
  if (!open) { c.fillStyle = "#6a4a30"; c.beginPath(); c.rect(bx - gap, fy - u * 0.05, gap * 2, 4); c.rect(bx - gap, fy - u * 0.022, gap * 2, 4); c.fill(); c.stroke(); }
  return cv;
}
// the fighter who walks the Road (the one you play last), drawn at 0.6x on the next stop
function rdPuppet() {
  const spec = FIG[P.last] || FIGHTERS[0];
  if (RD.pupId !== spec.id + ":" + (P.pal[spec.id] || 0)) {
    const pal = spec.palettes[P.pal[spec.id] || 0] || spec.palettes[0];
    RD.pup = BL.newGame({ players: [{ spec, pal }, { spec, pal }], countdown: 1 }).fighters[0];
    RD.pup.x = 0; RD.pup.y = 0; RD.pup.facing = 1; RD.pupId = spec.id + ":" + (P.pal[spec.id] || 0);
  }
  return RD.pup;
}
// one frame of the map on canvas cv (CSS size w x h); o.mini: the small copy on the menu card (no fighter hop, fewer details)
function roadPaint(cv, tk, o) {
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  const W = Math.round(w * DPR), H = Math.round(h * DPR);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext("2d"), r = roadGet();
  const key = `${w}x${h}@${DPR}:${r.s.join(".")}:${r.b}:${roadGateOpen(r)}`;
  const slot = o.mini ? "mini" : "big";
  RD.bgs = RD.bgs || {};
  if (!RD.bgs[slot] || RD.bgs[slot].key !== key) RD.bgs[slot] = { key, cv: rdBackground(w, h, DPR, r) };
  c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(RD.bgs[slot].cv, 0, 0);
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const { pts, gate } = rdPoints(w, h), u = Math.min(w, h), R = clamp(u * 0.052, o.mini ? 7 : 15, 30), next = roadNext(r);
  if (!o.mini) { RD.pts = pts; RD.R = R; RD.w = w; RD.h = h; }
  // beyond the fence: two horns over the hill and yellow eyes that blink
  const [bx, by] = pts[pts.length - 1], blink = (tk % 200) < 8;
  c.save(); c.translate(bx + u * 0.02, by - u * 0.12);
  c.fillStyle = "#f2d9a8"; c.strokeStyle = OUT; c.lineWidth = 1.5;
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * u * 0.03, 0); c.quadraticCurveTo(s * u * 0.07, -u * 0.03, s * u * 0.06, -u * 0.075); c.quadraticCurveTo(s * u * 0.045, -u * 0.03, s * u * 0.012, -u * 0.005); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle = "#ffd84a";
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * u * 0.018, u * 0.012, u * 0.011, blink ? 0.6 : u * 0.008, 0, 0, Math.PI * 2); c.fill(); }
  c.restore();
  // the stops: soil discs, the number, three star slots; won ones grow a sprout; the next one has a pulsing gold ring
  pts.forEach(([x, y], i) => {
    const boss = i === ROAD.length, bits = boss ? r.b : roadBits(r, i), open = boss ? roadGateOpen(r) : roadOpen(r, i);
    c.globalAlpha = open ? 1 : 0.55;
    c.fillStyle = boss ? (open ? "#6e1f18" : "#3a2014") : "#3a2014"; c.strokeStyle = OUT; c.lineWidth = o.mini ? 1.5 : 3;
    c.beginPath(); c.ellipse(x, y, R, R * 0.8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = boss && open ? "#ff8a3d" : "#7a4a2e"; c.lineWidth = o.mini ? 1 : 2;
    c.beginPath(); c.ellipse(x, y - 1, R * 0.78, R * 0.6, 0, 0, Math.PI * 2); c.stroke();
    if (!o.mini) {
      c.font = `900 ${Math.round(R * 0.8)}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = boss ? "#ffd84a" : "#f3e7d0";
      c.fillText(boss ? (open ? "☠" : "🔒") : String(i + 1), x, y + 1);
      if (boss && !open) { c.font = `800 ${Math.round(R * 0.5)}px "Barlow Condensed", sans-serif`; c.fillStyle = "#f3e7d0"; c.fillText(`${ROAD_GATE} ★`, x, y - R * 1.25); }
    }
    if (!boss && (bits & 1)) {   // a sprout on a won stop
      c.strokeStyle = OUT; c.lineWidth = o.mini ? 1 : 2; c.fillStyle = "#5fc14b";
      c.beginPath(); c.moveTo(x + R * 0.55, y - R * 0.45); c.lineTo(x + R * 0.55, y - R * 0.95); c.stroke();
      c.beginPath(); c.ellipse(x + R * 0.38, y - R * 0.98, R * 0.22, R * 0.12, -0.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(x + R * 0.72, y - R * 1.02, R * 0.22, R * 0.12, 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    for (let k = 0; k < 3; k++) rdStar(c, x + (k - 1) * R * 0.72, y + R * 1.12, R * (o.mini ? 0.32 : 0.3), bits & (1 << k) ? "#ffd23f" : "rgba(14,16,34,0.55)", OUT);
    if (i === Math.min(next, ROAD.length) && open && !(boss && (r.b & 7) === 7)) {
      const a = 0.5 + 0.5 * Math.sin(tk * 0.1);
      c.strokeStyle = `rgba(255,210,63,${0.5 + 0.5 * a})`; c.lineWidth = o.mini ? 1.5 : 3;
      c.beginPath(); c.ellipse(x, y, R * (1.2 + 0.08 * a), R * (0.98 + 0.06 * a), 0, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
  });
  // your fighter: on the next stop on the menu card; on the map where it last stood, walking the path to a stop (little hops, dust),
  // hopping for a moment when its own stop is tapped
  const f = rdPuppet(), home = Math.min(next, ROAD.length), sc = (R * 2.3) / f.s.h;
  let at, hop = 0;
  if (o.mini) { at = pts[home]; f.state = "idle"; f.facing = 1; }
  else {
    if (RD.pos === null) RD.pos = home;
    const wk = RD.walk;
    if (wk) {
      const k = Math.min(1, (performance.now() - wk.t0) / wk.ms), e = k * k * (3 - 2 * k), s0 = wk.a + (wk.b - wk.a) * e;   // by the clock, not frames
      const ph = k * Math.abs(wk.b - wk.a) * 2, land = Math.floor(ph) !== Math.floor(wk.ph);   // two hops per stop
      wk.ph = ph; RD.pos = s0;
      at = rdCurve([gate, ...pts], s0 + 1);
      hop = Math.abs(Math.sin(ph * Math.PI)) * R * 0.32;
      f.state = "run"; f.anim.run += 0.32; f.facing = wk.b > wk.a ? 1 : -1;
      if (land && k < 1) RD.dust.push({ x: at[0], y: at[1] + R * 0.3, t: 0 });
      if (k >= 1) { RD.walk = null; RD.pos = wk.b; f.state = "idle"; RD.hopT = 12; if (wk.then && mode === "road") wk.then(); }
    } else { at = pts[clamp(Math.round(RD.pos), 0, ROAD.length)]; f.state = "idle"; }
    if (RD.hopT > 0) { hop += Math.sin((1 - RD.hopT / 24) * Math.PI) * R * 1.2; RD.hopT--; }
    for (const d of RD.dust) {   // dust puffs where a hop lands
      d.t++; const a = 1 - d.t / 22;
      if (a <= 0) continue;
      c.fillStyle = `rgba(196,150,104,${0.55 * a})`;
      for (const s of [-1, 1]) { c.beginPath(); c.arc(d.x + s * (R * 0.25 + d.t * 0.5), d.y - d.t * 0.25, R * (0.1 + d.t * 0.008), 0, Math.PI * 2); c.fill(); }
    }
    RD.dust = RD.dust.filter((d) => d.t < 22);
  }
  c.save(); c.setTransform(DPR * sc, 0, 0, DPR * sc, DPR * (at[0] - R * 0.15), DPR * (at[1] - R * 0.35 - hop));
  try { drawFighter(c, f, o.mini ? 0 : tk); } catch (e) { /* a drawing problem never blocks the map */ }
  c.restore();
}
// walk your fighter along the path to stop i (the boss's gap is ROAD.length), then run then(); with reduced motion it is there at once
function rdWalk(i, then) {
  const a = RD.pos === null ? i : RD.pos, n = Math.abs(i - a);
  if (n < 0.01 || reducedMotion()) { RD.walk = null; RD.pos = i; if (then) then(); return; }
  RD.walk = { a, b: i, t0: performance.now(), ms: Math.min(430 * n + 170, 1600), ph: 0, then };
}

/* ----- the Road screen ----- */
screens.road = $("scrRoad");
// o.to: walk to that stop and open its sheet (Next stop on the results); without it your fighter walks on to the next stop if a win opened one
function openRoad(o) {
  finStop(); tutEnd();
  mode = "road"; sel.mode = "road"; paused = false; G = null; match = null; meSlot = 0;
  modal("roadStop", false); modal("pause", false); modal("help", false); modal("settings", false);
  clearTrails(); fx.length = 0; sfx.length = 0;
  show("road"); $("hud").hidden = true; $("ctl").hidden = true; hideBanner();
  roadHeader(); resize();
  requestAnimationFrame(roadHits);
  if (RD.walk) { RD.pos = RD.walk.b; RD.walk = null; }   // a walk left half way (Back, a fight started) ends where it was going
  const r = roadGet(), home = Math.min(roadNext(r), ROAD.length), to = o && o.to !== undefined ? o.to : null;
  if (RD.pos === null) RD.pos = home;
  if (to !== null) rdWalk(to, () => roadSheet(to));
  else if (RD.home !== null && RD.home !== home) rdWalk(home, null);
  RD.home = home;
}
function roadHeader() {
  const r = roadGet();
  $("roadSum").textContent = roadSummary(r);
  $("roadTokens").textContent = P.tokens;
}
// the tap targets over the discs (rebuilt when the map changes size or progress)
function roadHits() {
  const box = $("roadHits"), cv = $("roadCv"), r = roadGet();
  if (!cv.clientWidth) return;
  const { pts } = rdPoints(cv.clientWidth, cv.clientHeight), R = clamp(Math.min(cv.clientWidth, cv.clientHeight) * 0.052, 15, 30);
  const key = `${cv.clientWidth}x${cv.clientHeight}:${r.s.join(".")}:${r.b}`;
  if (box.dataset.key === key) return;
  box.dataset.key = key; box.innerHTML = "";
  pts.forEach(([x, y], i) => {
    const boss = i === ROAD.length, open = boss ? roadGateOpen(r) : roadOpen(r, i), b = document.createElement("button");
    b.className = "rd-hit"; b.style.left = `${x}px`; b.style.top = `${y}px`; b.style.setProperty("--s", `${Math.max(44, R * 2.4)}px`);
    const n = boss ? roadBossStars(r) : roadNStars(roadBits(r, i));
    b.setAttribute("aria-label", boss ? `Old Scratch, ${open ? `${n} of 3 stars` : `opens at ${ROAD_GATE} stars`}` : `Stop ${i + 1}, ${ROAD[i].name}, ${open ? `${n} of 3 stars` : "locked"}`);
    b.dataset.i = i;
    if (!open) b.classList.add("lock");
    b.addEventListener("click", () => {
      Sfx.init();
      if (!open) { Sfx.uiBack(); roadNote(boss ? `Win ${ROAD_GATE} stars on the Road to open the fence (you have ${roadTotal(roadGet())}).` : `Win stop ${i} first.`); return; }
      Sfx.ui();
      if (!RD.walk && Math.round(RD.pos) === i) { RD.hopT = 24; roadSheet(i); } else rdWalk(i, () => roadSheet(i));   // mid-walk: turn toward the new stop from where it is
    });
    box.appendChild(b);
  });
}
let roadNoteT = 0;
function roadNote(t) { const n = $("roadNote"); n.textContent = t; n.hidden = false; clearTimeout(roadNoteT); roadNoteT = setTimeout(() => { n.hidden = true; }, 2600); }
function roadDraw(tk) { roadPaint($("roadCv"), tk, {}); roadHits(); }

/* ----- a stop's sheet: you vs the CPU, the twist, the CPU's line, the three stars, Fight ----- */
function roadSheet(i) {
  RD.sel = i;
  const r = roadGet(), boss = i === ROAD.length, me = FIG[P.last] || FIGHTERS[0], mi = P.pal[me.id] || 0;
  $("rsKick").textContent = boss ? "The Road · past the fence" : `The Road · stop ${i + 1} of ${ROAD.length}`;
  $("rsName").textContent = boss ? "Old Scratch" : ROAD[i].name;
  dailyCard($("rsMe"), me.id, mi, "You");
  const sheet = $("roadStopSheet");
  sheet.classList.toggle("boss", boss);
  if (boss) {
    const b = BL.BOSSES.find((x) => x.id === ROAD_BOSS);
    const op = $("rsOp"); op.style.setProperty("--fc", col(b.palettes[0]));
    op.innerHTML = `<span class="dly-ph rd-bossph"><i>☠</i></span><span class="dly-t"><b>${b.name}</b><small>${b.role} · you + a CPU partner</small></span>`;
    $("rsRule").innerHTML = `<b>Two against one.</b> You and a CPU partner, 3 lives each. Break him (0 HP), then land a heavy, special or ulti.`;
    $("rsLine").textContent = BOSS_LINE[ROAD_BOSS];
    $("rsStars").innerHTML = BOSS_LV.map((n, k) => roadStarHTML(!!(r.b & (1 << k)), n)).join("");
    $("rsReward").textContent = r.paid ? "Every level won is a star." : `First win: the Devil Masher title and ${ROAD_BOSS_CHIPS} chips. Every level won is a star.`;
    $("rsLv").innerHTML = "";
    BOSS_LV.forEach((n, k) => {
      const bt = document.createElement("button");
      bt.className = "btn" + (k === 0 ? " primary" : ""); bt.innerHTML = `<span>${n}${r.b & (1 << k) ? " ★" : ""}</span>`;
      bt.addEventListener("click", () => { Sfx.init(); Sfx.uiGo(); goFull(); roadBossFight(k); });
      $("rsLv").appendChild(bt);
    });
  } else {
    const st = ROAD[i], op = FIG[st.f], bits = roadBits(r, i);
    dailyCard($("rsOp"), op.id, 0, st.cpu);
    const ru = roadRules(st);
    $("rsRule").innerHTML = `${ru.twist ? `<b>${cupEsc(ru.twist)}</b> ` : ""}${cupEsc(ru.rest)}`;
    $("rsLine").textContent = st.line;
    $("rsStars").innerHTML = [...ROAD_STARS, st.bonus.txt].map((n, k) => roadStarHTML(!!(bits & (1 << k)), n)).join("");
    $("rsReward").textContent = bits === 7 ? "All three stars won." : `Each new star: +${ROAD_STAR_CHIPS} chips.`;
  }
  modal("roadStop", true);
}
const roadStarHTML = (on, label) => `<span class="rd-st${on ? " on" : ""}"><i aria-hidden="true">★</i><small>${cupEsc(label)}</small></span>`;

/* ----- the fights ----- */
function roadFight(i) {
  const st = ROAD[i], r = roadGet();
  if (!st || !roadOpen(r, i)) { openRoad(); return; }
  Sfx.init(); modal("roadStop", false);
  const me = FIG[P.last] || FIGHTERS[0], myPal = me.palettes[P.pal[me.id]] || me.palettes[0], op = FIG[st.f];
  const opPal = op.palettes[op.id === me.id ? ((P.pal[me.id] || 0) + 1) % op.palettes.length : 0];
  const [a, b] = roadLives(st), map = Math.max(0, BL.MAPS.findIndex((m) => m.id === st.map));
  G = newGame({ players: [{ spec: me, pal: myPal, stocks: a, pct: st.myPct || 0, lifePct: st.myLifePct || 0 }, { spec: op, pal: opPal, stocks: b, pct: st.cpuPct || 0 }],
    stocks: a, time: roadSecs(st), countdown: 150, map });
  match = { ranked: false, road: { i, go: -1, end: -1, bonus: false }, d: st.d, oppRating: 0, bot: makeBot(st.d, BL.BOT_STYLES[op.id]), level: st.name, cpu: st.cpu };
  meSlot = 0;
  enterMatchUI();
}
function roadBossFight(lv) {
  const r = roadGet();
  if (!roadGateOpen(r)) { openRoad(); return; }
  modal("roadStop", false);
  startBoss({ level: lv, boss: ROAD_BOSS, road: { boss: true, lv } });
}
// handleEvent (effects.js) passes the live match's events: the start, the end, the KOs (a finisher special, an ulti)
function roadEvent(g, e) {
  const rd = match && match.road;
  if (!rd || rd.boss) return;
  if (e.type === "go") rd.go = g.t;
  else if (e.type === "game") rd.end = g.t;
  else if (e.type === "lethal" && e.by === meSlot && e.slot !== meSlot) {
    const k = ROAD[rd.i].bonus.k;
    if ((k === "fin" && e.fin) || (k === "ulti" && e.mv === "ulti")) rd.bonus = true;
  }
}
// a named combo route landed (effects.js, from comboRoute)
function roadRoute(e, rt) {
  const rd = match && match.road;
  if (!rd || rd.boss || e.slot !== meSlot) return;
  const b = ROAD[rd.i].bonus;
  if (b.k === "route" && rt.id === b.r) rd.bonus = true;
}
// finishMatch: a Road stop is over (a forfeit too): the stars, the chips, the results
function roadMatchEnd(forfeit) {
  const rd = match.road, st = ROAD[rd.i], me = G.fighters[0], op = G.fighters[1];
  const res = forfeit ? 0 : G.winner === 0 ? 1 : G.winner === 1 ? 0 : 0.5, won = res === 1;
  const secs = rd.go >= 0 ? ((rd.end >= 0 ? rd.end : G.t) - rd.go) / 60 : 1e9;
  const bonus = won && (st.bonus.k === "fast" ? secs < st.bonus.s : rd.bonus);
  const got = won ? 1 | (me.falls === 0 ? 2 : 0) | (bonus ? 4 : 0) : 0;
  const r = roadGet(), had = roadBits(r, rd.i), now = had | got, fresh = roadNStars(now) - roadNStars(had);
  const total = fresh * ROAD_STAR_CHIPS;
  if (fresh > 0) {
    r.s[rd.i] = now; P.road = r; P.tokens += total;
    saveProfile();
  }
  const gate = fresh > 0 && roadTotal(r) >= ROAD_GATE && roadTotal(r) - fresh < ROAD_GATE;   // this win opened the fence
  // a win: the big button goes on to the next stop (Old Scratch after the last one, once the fence is open); a loss: Retry
  rd.next = !won ? null : rd.i + 1 < ROAD.length ? { i: rd.i + 1 } : roadGateOpen(r) ? { i: ROAD.length } : null;
  const short = won && rd.i === ROAD.length - 1 && !roadGateOpen(r) ? ROAD_GATE - roadTotal(r) : 0;
  const why = forfeit ? "No stars for a forfeit." : !won ? "No stars this time. A win opens the next stop." :
    (fresh > 0 ? `${fresh} new ${fresh === 1 ? "star" : "stars"} +${total}` : got === 7 ? "Three stars again." : "No new stars this time.") +
    (gate ? " · The fence is open: Old Scratch waits past the last stop." : "") +
    (short ? ` · ${short} more ${short === 1 ? "star opens" : "stars open"} the fence.` : "");
  showResults({ res, forfeit, ranked: false, me, op, lines: [], total, why, road: { i: rd.i, got, had, labels: [...ROAD_STARS, st.bonus.txt] } });
}
// bossMatchEnd: a Road boss fight adds its star and the first win's reward to the results
function roadBossEnd(R) {
  const lv = match.road.lv, r = roadGet(), won = R.res === 1;
  let total = 0;
  const lines = [];
  if (won && !(r.b & (1 << lv))) { r.b |= 1 << lv; total += ROAD_STAR_CHIPS; lines.push(`${BOSS_LV[lv]} star +${ROAD_STAR_CHIPS}`); }
  if (won && !r.paid) { r.paid = true; total += ROAD_BOSS_CHIPS; lines.push(`Devil Masher title + ${ROAD_BOSS_CHIPS}`); }
  if (total) { P.road = r; P.tokens += total; saveProfile(); }
  R.total = total;
  R.why = R.forfeit ? "No stars for a forfeit." : !won ? "He'll be here. Try again with another partner, or on Normal." : lines.length ? lines.join(" · ") : `${BOSS_LV[lv]} already won.`;
  R.road = { boss: true, lv, got: won ? 1 << lv : 0, had: r.b & ~(won ? 1 << lv : 0), labels: BOSS_LV };
  match.road.next = won && lv + 1 < BOSS_LV.length ? { lv: lv + 1 } : null;   // a win offers the next level
}
// the results: the stop's three stars (the new ones pop)
function roadResStars(R) {
  const el = $("rStars"), rd = R.road;
  el.hidden = !rd;
  if (!rd) return;
  el.innerHTML = rd.labels.map((n, k) => {
    const on = !!((rd.got | rd.had) & (1 << k)), fresh = !!(rd.got & (1 << k)) && !(rd.had & (1 << k));
    return `<span class="rd-st${on ? " on" : ""}${fresh ? " new" : ""}" style="--k:${k}"><i aria-hidden="true">★</i><small>${cupEsc(n)}</small></span>`;
  }).join("");
}
// the results' big button: Next stop / To Old Scratch / Next: Hard after a win, Retry otherwise (menus.js rAgain does it)
function roadAgainLabel() {
  const nx = match && match.road && match.road.next;
  return !nx ? "Retry" : nx.lv !== undefined ? `Next: ${BOSS_LV[nx.lv]}` : nx.i >= ROAD.length ? "To Old Scratch" : "Next stop";
}
function roadAgain() {
  const rd = match.road, nx = rd.next;
  if (nx && nx.lv !== undefined) roadBossFight(nx.lv);
  else if (nx) openRoad({ to: nx.i });
  else if (rd.boss) roadBossFight(rd.lv);
  else roadFight(rd.i);
}
function roadResMode(R) {
  return R.road.boss ? `The Road · Old Scratch · ${BOSS_LV[R.road.lv]}` : `The Road · stop ${R.road.i + 1} · ${ROAD[R.road.i].name}`;
}

/* ----- the menu card: the map in small, "Stop 3 of 8 · 7 ★" ----- */
function roadCard() {
  $("mRoad").textContent = roadSummary(roadGet());
  requestAnimationFrame(() => roadPaint($("mRoadCv"), tick, { mini: true }));
}

$("roadBack").addEventListener("click", () => { Sfx.init(); Sfx.uiBack(); goMenu(); });
$("rsGo").addEventListener("click", () => { Sfx.init(); Sfx.uiGo(); goFull(); roadFight(RD.sel); });
$("rsPick").addEventListener("click", () => { Sfx.init(); Sfx.ui(); modal("roadStop", false); openSelect("road"); });
for (const id of ["rsBack", "rsClose"]) $(id).addEventListener("click", () => { Sfx.init(); Sfx.uiBack(); modal("roadStop", false); });
screens.roadStop = $("scrRoadStop");
// test hooks: the stops, the progress, start a stop or the boss, open the map, set the stars (as a synced profile would bring them)
window.__blRoad = { stops: ROAD, get: roadGet, fight: (i) => roadFight(i), boss: (lv) => roadBossFight(lv), open: openRoad,
  get walking() { return !!RD.walk; }, get pos() { return RD.pos; },
  set: (s) => { const r = roadGet(); P.road = { s: s.slice(), b: r.b, paid: r.paid }; saveProfile(); } };
