/* ===================== The Road: three regions of eight stops, each ending in a boss =====================
   Region 1 The Field (Old Scratch; Fable's design boss/fable-boss.md section 3), region 2 The Kitchen (Zorp) and region 3 The Deep
   (Kraken Spud; bosses2/fable-design.md). A stop is a 1v1 against a named CPU with one twist rule; three stars each: the win, no heart
   lost, the stop's bonus. A region's first stop opens when the region before it has its boss beaten (any level); then stop k opens when
   stop k-1 is won. 12 of a region's 24 stars open its fence: the boss (ui/boss.js) on Normal / Hard / Nightmare, a star each; his first
   win pays his title and 150 chips, and every boss win unlocks his Road skin for the fighter you used. Each new star pays 10 chips.
   Progress: P.road = { s: the stars per stop (24) as bits (1 win, 2 no heart lost, 4 bonus), then per region the boss levels won as
   bits and the first win paid: b / paid, b2 / p2, b3 / p3 } (sync.js merges it: every star either device won stays won). The map is
   drawn on a canvas (roadDraw), one region at a time; the stops are buttons laid over it. UI only: the twists are newGame options
   (lives, start percent, the percent every life starts at, the time, the map). A region whose boss is not in this build is "coming". */
// The difficulty rises over the whole Road, stop by stop (Jonny 2026-10-16; boss/road-curve-plan.md): d, the CPU's strength, climbs
// from 0.25 to 1.00 (the strongest CPU in the game), and the twists turn against you: in The Field they help or are even, in The Kitchen
// they are even or a little against you, in The Deep you start behind. tests/roadcurve.js plays every stop with bots and keeps it so.
const ROAD = [
  { id: "gate", name: "The Farm Gate", cpu: "Small Fry", f: "phoenix", d: 0.25, lives: 2, secs: 120, map: "field",
    line: "Gate's open. Mind the sprouts, they bite.", bonus: { k: "fast", s: 60, txt: "Win in under 60 s" } },
  { id: "sprout", name: "The Sprout Patch", cpu: "Mash", f: "odin", d: 0.4, secs: 120, map: "field", cpuPct: 40, twist: "Mash starts at 40%.",
    line: "Nobody moves Mash. Nobody.", bonus: { k: "route", r: "three", txt: "Land the Three-piece combo" } },
  { id: "scarecrow", name: "The Scarecrow's Post", cpu: "Straw Jack", f: "reaper", d: 0.4, secs: 120, map: "field", myPct: 20, twist: "You start at 20%.",
    line: "Caw. Just a scarecrow. Nothing with a scythe here.", bonus: { k: "fin", txt: "KO with a finisher special" } },
  { id: "well", name: "The Lord's Well", cpu: "Dr. Peel", f: "alchemist", d: 0.5, secs: 90, map: "castle", twist: "Win inside 90 seconds.",
    line: "Drink this. No? Then I'll throw it.", bonus: { k: "route", r: "lift", txt: "Land the Lift & Smash combo" } },
  { id: "crow", name: "Crow's Rest", cpu: "Bang Bang Maris", f: "gunslinger", d: 0.53, lives: 1, secs: 60, map: "field", twist: "One life each.",
    line: "One heart. One shot. Don't blink.", bonus: { k: "ulti", txt: "KO with an ulti" } },
  { id: "barn", name: "The Burnt Barn", cpu: "Cinder", f: "dragon", d: 0.56, map: "fryer", myPct: 50, twist: "You start at 50%.",
    line: "Smell that? That's you, in a minute.", bonus: { k: "route", r: "trip", txt: "Land the Trip & Spike combo" } },
  { id: "moon", name: "The Harvest Moon", cpu: "Moonie", f: "wizard", d: 0.59, map: "moon", myPct: 20, twist: "You start at 20%.",
    line: "The stars said you'd come. They were vague about the leaving.", bonus: { k: "ulti", txt: "KO with an ulti" } },
  { id: "edge", name: "The Field's Edge", cpu: "Sir Spudsalot", f: "samurai", d: 0.66, lives: 2, map: "field",
    line: "He's behind the fence. First, me.", bonus: { k: "fast", s: 120, txt: "Win in under 2 minutes" } },
];
// region 2, The Kitchen, and region 3, The Deep (bosses2/fable-design.md section 5)
const ROAD_KITCHEN = [
  { id: "backdoor", name: "The Back Door", cpu: "Dishwater Dan", f: "odin", d: 0.66, lives: 2, secs: 120, map: "kitchen",
    line: "Staff only. You staff? Didn't think so.", bonus: { k: "fast", s: 75, txt: "Win in under 75 s" } },
  { id: "pantry", name: "The Pantry", cpu: "Tin Can Tina", f: "gunslinger", d: 0.68, map: "kitchen", myPct: 30, twist: "You start at 30%.",
    line: "Everything in here has a date on it. Yours is today.", bonus: { k: "route", r: "sig", txt: "Land the Signature combo" } },
  { id: "cold", name: "The Cold Store", cpu: "Frosty Fritz", f: "wizard", d: 0.7, lives: 2, secs: 120, map: "moon",
    line: "Minus twenty in here. Don't worry, you'll stop shivering.", bonus: { k: "route", r: "rising", txt: "Land the Rising combo" } },
  { id: "stove", name: "The Stove", cpu: "Sizzle", f: "dragon", d: 0.72, secs: 120, map: "fryer", myPct: 40, twist: "You start at 40%.",
    line: "Oil's hot. Hop in, I'll time you.", bonus: { k: "fin", txt: "KO with a finisher special" } },
  { id: "spice", name: "The Spice Rack", cpu: "Paprika Pete", f: "phoenix", d: 0.72, lives: 1, secs: 60, map: "kitchen", twist: "One life each.",
    line: "One pinch. That's all it takes.", bonus: { k: "ulti", txt: "KO with an ulti" } },
  { id: "sink", name: "The Sink", cpu: "Suds", f: "alchemist", d: 0.76, secs: 120, map: "kitchen", myPct: 60, twist: "You start at 60%.",
    line: "Everything ends up in the sink. Even you.", bonus: { k: "route", r: "lift", txt: "Land the Lift & Smash combo" } },
  { id: "chef", name: "The Chef's Table", cpu: "Chef Rösti", f: "samurai", d: 0.8, lives: 1, map: "castle", twist: "One life each.",
    line: "Precision. Presentation. Then the plate.", bonus: { k: "route", r: "own", txt: "Land your fighter's own combo" } },
  { id: "window", name: "The Window", cpu: "Tinfoil Tom", f: "reaper", d: 0.8, lives: 2, map: "kitchen", myPct: 40, twist: "You start at 40%.",
    line: "They're watching. Through the window. I've seen the lights.", bonus: { k: "fast", s: 120, txt: "Win in under 2 minutes" } },
];
const ROAD_DEEP = [
  { id: "harbour", name: "The Harbour Wall", cpu: "Salty Sal", f: "samurai", d: 0.82, lives: 2, secs: 120, map: "deep", myPct: 20, twist: "You start at 20%.",
    line: "Mind the wall. Mind the drop. Mind me.", bonus: { k: "fast", s: 75, txt: "Win in under 75 s" } },
  { id: "market", name: "The Fish Market", cpu: "Haddock Hal", f: "gunslinger", d: 0.84, map: "bay", myLifePct: 10, twist: "You start every life at 10%.",
    line: "Fresh today! Well. Fresh-ish.", bonus: { k: "route", r: "trip", txt: "Land the Trip & Spike combo" } },
  { id: "lighthouse", name: "The Lighthouse", cpu: "Old Lamp", f: "wizard", d: 0.87, lives: 2, secs: 90, map: "deep", twist: "Win inside 90 seconds.",
    line: "Three flashes means rocks. Two means run. I only do one.", bonus: { k: "ulti", txt: "KO with an ulti" } },
  { id: "wreck", name: "The Wreck", cpu: "Barnacle Bill", f: "odin", d: 0.88, map: "castle", myPct: 40, twist: "You start at 40%.",
    line: "Went down with my ship. Came back up annoyed.", bonus: { k: "route", r: "three", txt: "Land the Three-piece combo" } },
  { id: "fog", name: "The Fog Bank", cpu: "Misty", f: "reaper", d: 0.9, secs: 120, map: "deep", myPct: 50, twist: "You start at 50%.",
    line: "Can't see a thing out here. Perfect.", bonus: { k: "route", r: "own", txt: "Land your fighter's own combo" } },
  { id: "trawler", name: "The Trawler", cpu: "Captain Crisp", f: "dragon", d: 0.93, lives: 1, secs: 90, map: "bay", myPct: 30, twist: "One life each, and you start at 30%.",
    line: "Net's down. Guess what's in it.", bonus: { k: "fin", txt: "KO with a finisher special" } },
  { id: "whirlpool", name: "The Whirlpool", cpu: "Gurgle", f: "alchemist", d: 0.96, secs: 120, map: "fryer", myPct: 60, cpuPct: 30, twist: "You start at 60%, Gurgle at 30%.",
    line: "Round and round. Down and down. Lovely.", bonus: { k: "route", r: "rising", txt: "Land the Rising combo" } },
  { id: "pier", name: "The End of the Pier", cpu: "The Harbour Master", f: "phoenix", d: 1, lives: 2, map: "deep", myPct: 30, twist: "You start at 30%.",
    line: "Nobody passes the end of the pier. Not without a ticket.", bonus: { k: "fast", s: 150, txt: "Win in under 2:30" } },
];
ROAD.push(...ROAD_KITCHEN, ...ROAD_DEEP);
// the regions in order: stops k*8 .. k*8+7, the boss past the fence, where his levels and first-win reward live in P.road, his title;
// hp / mate: on the Road each boss is tougher than the one before (his HP x hp, your CPU partner's strength mate on Normal, +0.1 a
// level), where Practice uses 3/4 HP and a .55 partner (ui/boss.js); online with a friend he has his Road HP x DUO_HP (ui/online.js)
const ROAD_REG = [
  { id: "field", name: "The Field", boss: "scratch", bk: "b", pk: "paid", title: "Devil Masher", hp: 0.9, mate: 0.5 },
  { id: "kitchen", name: "The Kitchen", boss: "zorp", bk: "b2", pk: "p2", title: "Dome Cracker", hp: 1.2, mate: 0.4 },
  { id: "deep", name: "The Deep", boss: "kraken", bk: "b3", pk: "p3", title: "Kraken Fryer", hp: 1.3, mate: 0.35 },
];
const ROAD_N = 8, ROAD_GATE = 12, ROAD_STAR_CHIPS = 10, ROAD_BOSS_CHIPS = 150;
const ROAD_STARS = ["Win", "No heart lost"];
function roadGet() { return SYNC.cleanRoad(P.road) || { s: [], b: 0, paid: false }; }
const roadBits = (r, i) => r.s[i] | 0;
const roadNStars = (bits) => (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
const roadRegOf = (i) => Math.floor(i / ROAD_N);
const roadBossSpec = (k) => BL.BOSSES.find((b) => b.id === ROAD_REG[k].boss) || null;
const roadRegReady = (k) => !!ROAD_REG[k] && !!roadBossSpec(k);   // a region whose boss this build does not have yet is "coming"
const roadBossBits = (r, k) => r[ROAD_REG[k].bk] | 0;
const roadRegOpen = (r, k) => roadRegReady(k) && (k === 0 || roadBossBits(r, k - 1) > 0);   // the boss before it beaten on any level
const roadRegStars = (r, k) => { let n = 0; for (let j = 0; j < ROAD_N; j++) n += roadNStars(roadBits(r, k * ROAD_N + j)); return n; };
const roadTotal = (r) => ROAD_REG.reduce((a, _, k) => a + roadRegStars(r, k) + roadNStars(roadBossBits(r, k)), 0);   // every star, bosses too
const roadOpen = (r, i) => roadRegOpen(r, roadRegOf(i)) && (i % ROAD_N === 0 || (roadBits(r, i - 1) & 1) === 1);   // the one before it won
const roadNext = (r, k) => { for (let j = 0; j < ROAD_N; j++) if (!(roadBits(r, k * ROAD_N + j) & 1)) return j; return ROAD_N; };   // 8 = every stop won
const roadGateOpen = (r, k) => roadRegStars(r, k) >= ROAD_GATE;
// the region the Road opens on: the last one that is open
const roadHome = (r) => { let k = 0; while (roadRegOpen(r, k + 1)) k++; return k; };
// RD.sel: a stop (0..23) or a region's boss (ROAD.length + k)
const roadIsBoss = (i) => i >= ROAD.length;
const roadSelName = (i) => (roadIsBoss(i) ? roadBossSpec(i - ROAD.length).name : `stop ${(i % ROAD_N) + 1}: ${ROAD[i].name}`);
const roadLives = (st) => [st.lives || 3, st.cpuLives || st.lives || 3];
const roadSecs = (st) => st.secs || 180;
const mmssR = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
// the stop's rules in one line: the twist in bold, then lives, time, map
function roadRules(st) {
  const [a, b] = roadLives(st), lives = a === b ? `${a} ${a === 1 ? "life" : "lives"} each` : `${a} lives vs ${b}`;
  const mi = BL.MAPS.findIndex((m) => m.id === st.map);
  return { twist: st.twist || "", rest: `${lives} · ${mmssR(roadSecs(st))} · ${mapName(Math.max(0, mi))}` };
}
// region k: "Stop 3 of 8 · 7 ★" (every stop won: "Old Scratch · 7 ★"); the stars are the whole Road's
function roadSummary(r, k) {
  const n = roadNext(r, k), t = roadTotal(r);
  return `${n < ROAD_N ? `Stop ${n + 1} of ${ROAD_N}` : roadGateOpen(r, k) ? roadBossSpec(k).name : `${ROAD_GATE} ★ open the fence`} · ${t} ★`;
}

/* ----- the map: a dirt path from the gate (bottom left) to the fence gap (top right) across the night field ----- */
// stop positions as fractions of the map (wide screens, then upright ones); the last point is the fence gap (the boss)
const RD_WIDE = [[0.12, 0.76], [0.26, 0.86], [0.38, 0.68], [0.25, 0.5], [0.41, 0.36], [0.57, 0.5], [0.71, 0.64], [0.8, 0.43], [0.9, 0.2]];
const RD_TALL = [[0.24, 0.87], [0.6, 0.85], [0.8, 0.72], [0.5, 0.63], [0.2, 0.55], [0.36, 0.44], [0.7, 0.4], [0.56, 0.28], [0.76, 0.13]];
const RD_GATE = { wide: [0.03, 0.9], tall: [0.06, 0.95] };
const RD = { cv: null, bg: null, key: "", hop: -1, hopT: 0, pup: null, pupId: "", pts: [], R: 20, w: 0, h: 0, sel: -1, reg: 0,   // reg: the region shown
  pos: null, posK: -1, homes: {}, walk: null, dust: [] };
// pos: where your fighter stands on region posK's path (-1 its gate, 0..7 the stops, 8 the boss; a fraction while walking);
// homes: each region's next stop when it was last shown; walk: { a, b, t0, ms, ph, then }
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
// the still part of region k's map, cached per size and progress: its art's bg (RD_ART by region id; The Field's is below)
function rdBackground(w, h, s, r, k) {
  const cv = document.createElement("canvas"); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
  const c = cv.getContext("2d"); c.scale(s, s);
  (RD_ART[ROAD_REG[k].id] || RD_ART.field).bg(c, w, h, r, k);
  return cv;
}
// each region's map art: bg(c, w, h, r, k) the still part (sky, ground, the path through rdPoints, the gate, the fence; roadGateOpen(r, k)
// opens it), peek(c, x, y, u, tk) the boss's glimpse over the fence gap (x, y = the boss stop), ink: the disc colours, and optionally
// won(c, x, y, R, mini): the mark on a won stop in place of the sprout
const RD_ART = {};
RD_ART.field = { bg: rdField, peek: rdFieldPeek };
// The Field: sky, moon, hills, field, path, fence
function rdField(c, w, h, r, k) {
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
  const open = roadGateOpen(r, k), gap = u * 0.07;
  for (const side of [-1, 1]) {
    const x0 = bx + side * gap, x1 = side < 0 ? Math.max(0, bx - u * 0.42) : Math.min(w, bx + u * 0.42);
    for (let x = x0; side < 0 ? x > x1 : x < x1; x += side * u * 0.055) { c.beginPath(); c.rect(x - 3, fy - u * 0.07, 6, u * 0.075); c.fill(); c.stroke(); }
    c.beginPath(); c.rect(Math.min(x0, x1), fy - u * 0.055, Math.abs(x1 - x0), 4); c.fill(); c.stroke();
    c.beginPath(); c.rect(Math.min(x0, x1), fy - u * 0.025, Math.abs(x1 - x0), 4); c.fill(); c.stroke();
  }
  if (!open) { c.fillStyle = "#6a4a30"; c.beginPath(); c.rect(bx - gap, fy - u * 0.05, gap * 2, 4); c.rect(bx - gap, fy - u * 0.022, gap * 2, 4); c.fill(); c.stroke(); }
}
// beyond The Field's fence: two horns over the hill and yellow eyes that blink
function rdFieldPeek(c, bx, by, u, tk) {
  const blink = (tk % 200) < 8;
  c.save(); c.translate(bx + u * 0.02, by - u * 0.12);
  c.fillStyle = "#f2d9a8"; c.strokeStyle = OUT; c.lineWidth = 1.5;
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * u * 0.03, 0); c.quadraticCurveTo(s * u * 0.07, -u * 0.03, s * u * 0.06, -u * 0.075); c.quadraticCurveTo(s * u * 0.045, -u * 0.03, s * u * 0.012, -u * 0.005); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle = "#ffd84a";
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * u * 0.018, u * 0.012, u * 0.011, blink ? 0.6 : u * 0.008, 0, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
// the fighter who walks the Road (the one you play last), drawn at 0.6x on the next stop
function rdPuppet() {
  const spec = FIG[P.last] || FIGHTERS[0];
  if (RD.pupId !== spec.id + ":" + (P.pal[spec.id] || 0)) {
    const pal = spec.palettes[P.pal[spec.id] || 0] || spec.palettes[0];
    RD.pup = BL.newGame({ seed: 1, players: [{ spec, pal }, { spec, pal }], countdown: 1 }).fighters[0];
    RD.pup.x = 0; RD.pup.y = 0; RD.pup.facing = 1; RD.pupId = spec.id + ":" + (P.pal[spec.id] || 0);
  }
  return glazeMark(RD.pup, glazeHas(spec.id, P.pal[spec.id] || 0));   // ui/glaze.js
}
// one frame of the map on canvas cv (CSS size w x h); o.mini: the small copy on the menu card (no fighter hop, fewer details)
function roadPaint(cv, tk, o) {
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  const W = Math.round(w * DPR), H = Math.round(h * DPR);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext("2d"), r = roadGet(), k = o.mini ? roadHome(r) : RD.reg, A = RD_ART[ROAD_REG[k].id] || RD_ART.field;
  const ink = Object.assign({ disc: "#3a2014", ring: "#7a4a2e", boss: "#6e1f18", bossRing: "#ff8a3d", num: "#f3e7d0" }, A.ink);
  const key = `${k}:${w}x${h}@${DPR}:${r.s.join(".")}:${roadBossBits(r, k)}:${roadGateOpen(r, k)}`;
  const slot = o.mini ? "mini" : "big";
  RD.bgs = RD.bgs || {};
  if (!RD.bgs[slot] || RD.bgs[slot].key !== key) RD.bgs[slot] = { key, cv: rdBackground(w, h, DPR, r, k) };
  c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(RD.bgs[slot].cv, 0, 0);
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const { pts, gate } = rdPoints(w, h), u = Math.min(w, h), R = clamp(u * 0.052, o.mini ? 7 : 15, 30), next = roadNext(r, k), bb = roadBossBits(r, k);
  if (!o.mini) { RD.pts = pts; RD.R = R; RD.w = w; RD.h = h; }
  // beyond the fence: the boss's glimpse
  const [bx, by] = pts[pts.length - 1];
  A.peek(c, bx, by, u, tk);
  // the stops: discs, the number, three star slots; won ones grow a sprout; the next one has a pulsing gold ring
  pts.forEach(([x, y], j) => {
    const boss = j === ROAD_N, i = k * ROAD_N + j, bits = boss ? bb : roadBits(r, i), open = boss ? roadGateOpen(r, k) : roadOpen(r, i);
    c.globalAlpha = open ? 1 : 0.55;
    c.fillStyle = boss && open ? ink.boss : ink.disc; c.strokeStyle = OUT; c.lineWidth = o.mini ? 1.5 : 3;
    c.beginPath(); c.ellipse(x, y, R, R * 0.8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = boss && open ? ink.bossRing : ink.ring; c.lineWidth = o.mini ? 1 : 2;
    c.beginPath(); c.ellipse(x, y - 1, R * 0.78, R * 0.6, 0, 0, Math.PI * 2); c.stroke();
    if (!o.mini) {
      c.font = `900 ${Math.round(R * 0.8)}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = boss ? "#ffd84a" : ink.num;
      c.fillText(boss ? (open ? "☠" : "🔒") : String(j + 1), x, y + 1);
      if (boss && !open) { c.font = `800 ${Math.round(R * 0.5)}px "Barlow Condensed", sans-serif`; c.fillStyle = "#f3e7d0"; c.fillText(`${ROAD_GATE} ★`, x, y - R * 1.25); }
    }
    if (!boss && (bits & 1) && A.won) A.won(c, x, y, R, o.mini);   // a won stop: the region's own mark (The Kitchen's fork and knife are in its bg)
    else if (!boss && (bits & 1)) {   // a sprout on a won stop
      c.strokeStyle = OUT; c.lineWidth = o.mini ? 1 : 2; c.fillStyle = "#5fc14b";
      c.beginPath(); c.moveTo(x + R * 0.55, y - R * 0.45); c.lineTo(x + R * 0.55, y - R * 0.95); c.stroke();
      c.beginPath(); c.ellipse(x + R * 0.38, y - R * 0.98, R * 0.22, R * 0.12, -0.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(x + R * 0.72, y - R * 1.02, R * 0.22, R * 0.12, 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    for (let q = 0; q < 3; q++) rdStar(c, x + (q - 1) * R * 0.72, y + R * 1.12, R * (o.mini ? 0.32 : 0.3), bits & (1 << q) ? "#ffd23f" : "rgba(14,16,34,0.55)", OUT);
    if (j === Math.min(next, ROAD_N) && open && !(boss && (bb & 7) === 7)) {
      const a = 0.5 + 0.5 * Math.sin(tk * 0.1);
      c.strokeStyle = `rgba(255,210,63,${0.5 + 0.5 * a})`; c.lineWidth = o.mini ? 1.5 : 3;
      c.beginPath(); c.ellipse(x, y, R * (1.2 + 0.08 * a), R * (0.98 + 0.06 * a), 0, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
  });
  // your fighter: on the next stop on the menu card; on the map where it last stood, walking the path to a stop (little hops, dust),
  // hopping for a moment when its own stop is tapped
  const f = rdPuppet(), home = Math.min(next, ROAD_N), sc = (R * 2.3) / f.s.h, all = [gate, ...pts];
  let at, hop = 0;
  if (o.mini) { at = pts[home]; f.state = "idle"; f.facing = 1; }
  else {
    rdRegPos(k);
    if (RD.pos === null) RD.pos = home;
    const wk = RD.walk;
    if (wk) {
      const q = Math.min(1, (performance.now() - wk.t0) / wk.ms), e = q * q * (3 - 2 * q), s0 = wk.a + (wk.b - wk.a) * e;   // by the clock, not frames
      const ph = q * Math.abs(wk.b - wk.a) * 2, land = Math.floor(ph) !== Math.floor(wk.ph);   // two hops per stop
      wk.ph = ph; RD.pos = s0;
      at = rdCurve(all, s0 + 1);
      hop = Math.abs(Math.sin(ph * Math.PI)) * R * 0.32;
      f.state = "run"; f.anim.run += 0.32; f.facing = wk.b > wk.a ? 1 : -1;
      if (land && q < 1) RD.dust.push({ x: at[0], y: at[1] + R * 0.3, t: 0 });
      if (q >= 1) { RD.walk = null; RD.pos = wk.b; f.state = "idle"; RD.hopT = 12; if (wk.then && mode === "road") wk.then(); }
    } else { at = rdCurve(all, clamp(Math.round(RD.pos), -1, ROAD_N) + 1); f.state = "idle"; }
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
// walk your fighter along the shown region's path to stop i (0..7; the boss's gap is 8), then run then(); with reduced motion it is there at once
function rdWalk(i, then) {
  const a = RD.pos === null ? i : RD.pos, n = Math.abs(i - a);
  if (n < 0.01 || reducedMotion()) { RD.walk = null; RD.pos = i; if (then) then(); return; }
  RD.walk = { a, b: i, t0: performance.now(), ms: Math.min(430 * n + 170, 1600), ph: 0, then };
}
// the fighter's spot belongs to one region: showing another starts it afresh there
function rdRegPos(k) { if (RD.posK !== k) { RD.posK = k; RD.walk = null; RD.pos = null; RD.dust = []; } }
// your fighter on the region shown: a walk left half way (Back, a fight started) ends where it was going; to (a stop, or ROAD.length + k
// for a boss) walks there and opens its sheet; otherwise it walks on to the next stop if a win opened one since the region was last
// shown. A region shown for the first time with nothing won: in at its gate, walking to stop 1.
function rdArrive(to) {
  const r = roadGet(), k = RD.reg, home = Math.min(roadNext(r, k), ROAD_N), seen = RD.homes[k];
  if (RD.walk) { RD.pos = RD.walk.b; RD.walk = null; }
  rdRegPos(k);
  if (RD.pos === null) RD.pos = seen !== undefined ? seen : home === 0 ? -1 : home;
  if (to !== null) rdWalk(roadIsBoss(to) ? ROAD_N : to % ROAD_N, () => roadSheet(to));
  else if (RD.pos < 0 || (seen !== undefined && seen !== home)) rdWalk(home, null);
  RD.homes[k] = home;
}

/* ----- the Road screen ----- */
screens.road = $("scrRoad");
// o.to: walk to that stop (ROAD.length + k: region k's boss) and open its sheet (Next stop on the results); o.reg: show that region;
// without them your fighter walks on to the next stop if a win opened one (rdArrive)
function openRoad(o) {
  finStop(); tutEnd();
  mode = "road"; sel.mode = "road"; paused = false; G = null; match = null; meSlot = 0;
  modal("roadStop", false); modal("pause", false); modal("help", false); modal("settings", false);
  clearTrails(); fx.length = 0; sfx.length = 0;
  show("road"); $("hud").hidden = true; $("ctl").hidden = true; hideBanner();
  const r = roadGet(), to = o && o.to !== undefined && o.to !== null ? o.to : null;
  if (o && o.reg !== undefined) RD.reg = o.reg;
  if (to !== null) RD.reg = roadIsBoss(to) ? to - ROAD.length : roadRegOf(to);
  if (!roadRegOpen(r, RD.reg)) RD.reg = roadHome(r);
  roadHeader(); resize();
  requestAnimationFrame(roadHits);
  rdArrive(to);
}
function roadHeader() {
  const r = roadGet(), k = RD.reg;
  $("roadKick").textContent = `The Road · region ${k + 1} of ${ROAD_REG.length}`;
  $("roadReg").textContent = ROAD_REG[k].name;
  $("roadSum").textContent = roadSummary(r, k);
  $("roadTokens").textContent = fmtChips(P.tokens);
  $("roadPrev").disabled = k === 0;
  const nx = k + 1 < ROAD_REG.length;
  $("roadNext").disabled = !nx;
  $("roadNext").classList.toggle("lock", nx && !roadRegOpen(r, k + 1));
}
// the arrows beside the region's name: the region before / after (a locked one says what opens it)
function roadGo(d) {
  const r = roadGet(), k = RD.reg + d;
  if (k < 0 || k >= ROAD_REG.length) return;
  Sfx.init();
  if (!roadRegOpen(r, k)) {
    Sfx.uiBack();
    roadNote(!roadRegReady(k) ? `${ROAD_REG[k].name} is coming soon.` : `Beat ${roadBossSpec(k - 1).name} past the fence of ${ROAD_REG[k - 1].name} to open ${ROAD_REG[k].name}.`);
    return;
  }
  Sfx.uiFlip(); RD.reg = k; RD.hopT = 0; $("roadHits").dataset.key = ""; roadHeader(); rdArrive(null);
}
// the tap targets over the discs (rebuilt when the map changes size or progress)
function roadHits() {
  const box = $("roadHits"), cv = $("roadCv"), r = roadGet();
  if (!cv.clientWidth) return;
  const { pts } = rdPoints(cv.clientWidth, cv.clientHeight), R = clamp(Math.min(cv.clientWidth, cv.clientHeight) * 0.052, 15, 30);
  const k = RD.reg, key = `${k}:${cv.clientWidth}x${cv.clientHeight}:${r.s.join(".")}:${roadBossBits(r, k)}`;
  if (box.dataset.key === key) return;
  box.dataset.key = key; box.innerHTML = "";
  pts.forEach(([x, y], j) => {
    const boss = j === ROAD_N, i = boss ? ROAD.length + k : k * ROAD_N + j, open = boss ? roadGateOpen(r, k) : roadOpen(r, i), b = document.createElement("button");
    b.className = "rd-hit"; b.style.left = `${x}px`; b.style.top = `${y}px`; b.style.setProperty("--s", `${Math.max(44, R * 2.4)}px`);
    const n = boss ? roadNStars(roadBossBits(r, k)) : roadNStars(roadBits(r, i)), bn = roadBossSpec(k).name;
    b.setAttribute("aria-label", boss ? `${bn}, ${open ? `${n} of 3 stars` : `opens at ${ROAD_GATE} stars`}` : `Stop ${j + 1}, ${ROAD[i].name}, ${open ? `${n} of 3 stars` : "locked"}`);
    b.dataset.i = i;
    if (!open) b.classList.add("lock");
    b.addEventListener("click", () => {
      Sfx.init();
      if (!open) { Sfx.uiBack(); roadNote(boss ? `Win ${ROAD_GATE} stars in ${ROAD_REG[k].name} to open the fence (you have ${roadRegStars(roadGet(), k)}).` : `Win stop ${j} first.`); return; }
      Sfx.ui();
      if (!RD.walk && Math.round(RD.pos) === j) { RD.hopT = 24; roadSheet(i); } else rdWalk(j, () => roadSheet(i));   // mid-walk: turn toward the new stop from where it is
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
  const r = roadGet(), boss = roadIsBoss(i), k = boss ? i - ROAD.length : roadRegOf(i), me = FIG[P.last] || FIGHTERS[0], mi = P.pal[me.id] || 0;
  const RG_ = ROAD_REG[k], bspec = roadBossSpec(k);
  $("rsKick").textContent = boss ? `${RG_.name} · past the fence` : `${RG_.name} · stop ${(i % ROAD_N) + 1} of ${ROAD_N}`;
  $("rsName").textContent = boss ? bspec.name : ROAD[i].name;
  dailyCard($("rsMe"), me.id, mi, "You · tap to change");   // your card is the fighter picker
  $("rsMe").insertAdjacentHTML("beforeend", `<span class="rd-chg" aria-hidden="true">⇄</span>`);
  const sheet = $("roadStopSheet");
  sheet.classList.toggle("boss", boss);
  $("rsTeam").hidden = !boss || !onlineHere();   // a boss: Team up with a friend online (ui/online.js teamUp), where online play exists
  if (boss) {
    const b = bspec, bb = roadBossBits(r, k), rs = roadSkinOf(me, b.id);
    const op = $("rsOp"); op.style.setProperty("--fc", col(b.palettes[0]));
    op.innerHTML = `<span class="dly-ph rd-bossph rd-${b.id}"><i>☠</i></span><span class="dly-t"><b>${b.name}</b><small>${b.role}<span class="rd-sep"> · </span><span class="rd-cp">you + a CPU partner</span></small></span>`;
    $("rsRule").innerHTML = `<b>Two against one.</b> You and a CPU partner, 3 lives each. ${BOSS_RULE[b.id] || "Break him (0 HP), then land a heavy, special or ulti."}`;
    $("rsLine").textContent = BOSS_LINE[b.id] || "";
    // the level stars are the picker: it starts on the first level not won yet; Fight plays the picked one
    const first = BOSS_LV.findIndex((_, q) => !(bb & (1 << q)));
    RD.blv = first >= 0 ? first : clamp(RD.blv | 0, 0, BOSS_LV.length - 1);
    $("rsStars").innerHTML = BOSS_LV.map((n, q) => roadStarHTML(!!(bb & (1 << q)), n, q)).join("");
    $("rsCombo").hidden = true;
    rdLevel(RD.blv);
    const skin = rs < 0 ? "" : (P.owned[me.id] || []).includes(rs) ? ` ${me.name} has his ${me.palettes[rs].name} skin.` : ` A win gives ${me.name} the ${me.palettes[rs].name} skin.`;
    $("rsReward").textContent = (r[RG_.pk] ? "Every level won is a star." : `First win: the ${RG_.title} title and ${ROAD_BOSS_CHIPS} chips.`) + skin;
  } else {
    const st = ROAD[i], op = FIG[st.f], bits = roadBits(r, i);
    dailyCard($("rsOp"), op.id, 0, st.cpu);
    const ru = roadRules(st);
    $("rsRule").innerHTML = `${ru.twist ? `<b>${cupEsc(ru.twist)}</b> ` : ""}${cupEsc(ru.rest)}`;
    $("rsLine").textContent = st.line;
    $("rsStars").innerHTML = [...ROAD_STARS, st.bonus.txt].map((n, k) => roadStarHTML(!!(bits & (1 << k)), n)).join("");
    // a combo star: the combo's name and buttons under the stars (your fighter's own combo follows the fighter); a tap opens the Combo trial on it
    const rt = roadRouteOf(st, me.id), cb = $("rsCombo");
    cb.hidden = !rt;
    if (rt) cb.innerHTML = `<button class="rd-cmb" id="rsComboGo" aria-label="${cupEsc(rt.name)} combo: practise it in the Combo trial"><span class="rd-cn">${cupEsc(rt.name)}</span><span class="rk-row">${routeKeysHTML(rt)}</span><i class="rd-cgo" aria-hidden="true"></i></button>`;
    $("rsReward").textContent = bits === 7 ? "All three stars won." : `Each new star: +${ROAD_STAR_CHIPS} chips.`;
    $("rsGo").querySelector("span").textContent = "Fight";
  }
  modal("roadStop", true);
  roadSheetFit();
}
// a short sheet (a phone held sideways): when the combo line would sit under Fight, the CPU's line makes room for it
// (offsets, not screen boxes: the app may be turned sideways)
function roadSheetFit() {
  const sh = $("roadStopSheet"), cb = $("rsCombo");
  sh.classList.remove("tight");
  if (cb.hidden) return;
  let y = cb.offsetHeight;
  for (let e = cb; e && e !== sh; e = e.offsetParent) y += e.offsetTop;
  if (y > sh.clientHeight - sh.querySelector(".rd-acts").offsetHeight) sh.classList.add("tight");
}
// a star with its label; with q (a boss level) it is a button that picks that level
const roadStarHTML = (on, label, q) => q === undefined ? `<span class="rd-st${on ? " on" : ""}"><i aria-hidden="true">★</i><small>${cupEsc(label)}</small></span>`
  : `<button class="rd-st rd-lvb${on ? " on" : ""}" data-q="${q}" aria-pressed="false"><i aria-hidden="true">★</i><small>${cupEsc(label)}</small></button>`;
function rdLevel(q) {
  RD.blv = q;
  for (const b of $("rsStars").querySelectorAll(".rd-lvb")) { const on = +b.dataset.q === q; b.classList.toggle("sel", on); b.setAttribute("aria-pressed", String(on)); }
  $("rsGo").querySelector("span").textContent = `Fight · ${BOSS_LV[q]}`;
}

/* ----- the fights ----- */
function roadFight(i) {
  const st = ROAD[i], r = roadGet();
  if (!st || !roadOpen(r, i)) { openRoad(); return; }
  Sfx.init(); modal("roadStop", false);
  const me = FIG[P.last] || FIGHTERS[0], myPal = me.palettes[P.pal[me.id]] || me.palettes[0], op = FIG[st.f];
  const opPal = op.palettes[op.id === me.id ? ((P.pal[me.id] || 0) + 1) % chipN(op) : 0];
  const [a, b] = roadLives(st), map = Math.max(0, BL.MAPS.findIndex((m) => m.id === st.map));
  G = newGame({ seed: newSeed(), players: [{ spec: me, pal: myPal, stocks: a, pct: st.myPct || 0, lifePct: st.myLifePct || 0 }, { spec: op, pal: opPal, stocks: b, pct: st.cpuPct || 0 }],
    stocks: a, time: roadSecs(st), countdown: 150, map });
  match = { ranked: false, road: { i, go: -1, end: -1, bonus: false }, d: st.d, oppRating: 0, bot: makeBot(st.d, BL.BOT_STYLES[op.id]), level: st.name, cpu: st.cpu };
  meSlot = 0;
  enterMatchUI();
}
function roadBossFight(k, lv) {
  const r = roadGet();
  if (!roadRegOpen(r, k) || !roadGateOpen(r, k)) { openRoad(); return; }
  modal("roadStop", false);
  const RG_ = ROAD_REG[k];
  startBoss({ level: lv, boss: RG_.boss, hpMul: RG_.hp, mate: RG_.mate + 0.1 * lv, road: { boss: true, k, lv } });
}
// handleEvent (effects.js) passes the live match's events: the start, the end, the KOs (a finisher special, an ulti)
function roadEvent(g, e) {
  bwEvent(g, e);   // ui/bossweek.js: a Boss Week try's GO and final launch
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
  // "own": the route of the fighter you play
  if (b.k === "route" && (rt.id === b.r || (b.r === "own" && rt.fighter === G.fighters[meSlot].spec.id))) rd.bonus = true;
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
  const k = roadRegOf(rd.i), j = rd.i % ROAD_N, rs = roadRegStars(r, k);
  const gate = fresh > 0 && rs >= ROAD_GATE && rs - fresh < ROAD_GATE;   // this win opened the fence
  // a win: the big button goes on to the next stop (the region's boss after its last one, once the fence is open); a loss: Retry
  rd.next = !won ? null : j + 1 < ROAD_N ? { i: rd.i + 1 } : roadGateOpen(r, k) ? { i: ROAD.length + k } : null;
  const short = won && j === ROAD_N - 1 && !roadGateOpen(r, k) ? ROAD_GATE - rs : 0;
  const why = forfeit ? "No stars for a forfeit." : !won ? "No stars this time. A win opens the next stop." :
    (fresh > 0 ? `${fresh} new ${fresh === 1 ? "star" : "stars"} +${total}` : got === 7 ? "Three stars again." : "No new stars this time.") +
    (gate ? ` · The fence is open: ${roadBossSpec(k).name} waits past the last stop.` : "") +
    (short ? ` · ${short} more ${short === 1 ? "star opens" : "stars open"} the fence.` : "");
  showResults({ res, forfeit, ranked: false, me, op, lines: [], total, why, road: { i: rd.i, got, had, labels: [...ROAD_STARS, st.bonus.txt] } });
}
// bossMatchEnd: a Road boss fight adds its star, the first win's reward and the fighter's Road skin to the results
function roadBossEnd(R) {
  const { k, lv } = match.road, won = R.res === 1, bit = 1 << lv;
  const w = won ? roadBossWin(k, lv, R.me.spec) : { total: 0, lines: [], had: roadBossBits(roadGet(), k), skin: null };
  if (w.skin) R.skin = w.skin;
  R.total = w.total;
  R.why = R.forfeit ? "No stars for a forfeit." : !won ? "He'll be here. Try again with another partner, or on Normal." : w.lines.length ? w.lines.join(" · ") : `${BOSS_LV[lv]} already won.`;
  R.road = { boss: true, k, lv, got: won ? bit : 0, had: w.had & ~(won ? bit : 0), labels: BOSS_LV };
  // a win goes on: into the next region when this first win opened it, else to the next level (after Nightmare, the next region)
  const nk = k + 1 < ROAD_REG.length && roadRegReady(k + 1) ? k + 1 : -1;
  match.road.next = !won ? null : nk >= 0 && !w.had ? { k: nk } : lv + 1 < BOSS_LV.length ? { lv: lv + 1 } : nk >= 0 ? { k: nk } : null;
}
// region k's boss beaten on level lv, on the Road or online with a friend (ui/online.js finishBossOnline): the level's star, the first win's
// title and chips, this boss's Road skin for the fighter played (if it doesn't have it yet), saved. Each is paid once. Returns
// { total: chips, lines, had: his level bits before, skin: { f, i } or null }
function roadBossWin(k, lv, spec) {
  const RG_ = ROAD_REG[k], r = roadGet(), bit = 1 << lv, had = r[RG_.bk] | 0, lines = [], rs = roadSkinOf(spec, RG_.boss);
  let total = 0, skin = null;
  if (!(had & bit)) { r[RG_.bk] = had | bit; total += ROAD_STAR_CHIPS; lines.push(`${BOSS_LV[lv]} star +${ROAD_STAR_CHIPS}`); }
  if (!r[RG_.pk]) { r[RG_.pk] = true; total += ROAD_BOSS_CHIPS; lines.push(`${RG_.title} title + ${ROAD_BOSS_CHIPS}`); }
  if (rs >= 0 && !(P.owned[spec.id] || []).includes(rs)) { P.owned[spec.id] = [...(P.owned[spec.id] || [0]), rs]; skin = { f: spec.id, i: rs }; lines.push(`${spec.palettes[rs].name} skin for ${spec.name}`); }
  if (k + 1 < ROAD_REG.length && roadRegReady(k + 1) && !had) lines.push(`${ROAD_REG[k + 1].name} is open`);
  if (total || skin) { P.road = r; P.tokens += total; saveProfile(); }
  return { total, lines, had, skin };
}
// the Road skin a boss gives this fighter: its palette index (-1 = none)
const roadSkinOf = (spec, bossId) => spec.palettes.findIndex((p) => p.road === bossId);
// the results: the stop's three stars (the new ones pop)
// (a missed combo star names its combo and shows its buttons, as on the stop's sheet: a tap opens the Combo trial on it)
function roadResStars(R) {
  const el = $("rStars"), rd = R.road;
  el.hidden = !rd;
  if (!rd) return;
  const rt = rd.boss ? null : roadRouteOf(ROAD[rd.i], R.me.spec.id);
  el.innerHTML = rd.labels.map((n, k) => {
    const on = !!((rd.got | rd.had) & (1 << k)), fresh = !!(rd.got & (1 << k)) && !(rd.had & (1 << k));
    if (k === 2 && rt && !on) return `<button class="rd-st rd-stk" style="--k:${k}" data-i="${rd.i}" aria-label="Combo star missed: ${cupEsc(rt.name)}. Practise it in the Combo trial"><i aria-hidden="true">★</i><small>${cupEsc(rt.name)}</small><span class="rk-row">${routeKeysHTML(rt)}</span></button>`;
    return `<span class="rd-st${on ? " on" : ""}${fresh ? " new" : ""}" style="--k:${k}"><i aria-hidden="true">★</i><small>${cupEsc(n)}</small></span>`;
  }).join("");
}
// the results' Retry beside Next stop after a win (Next: Hard after a boss win): its second line names the first star still missing;
// with all three stars (or no next step, when the big button is Retry already) it hides and the big button takes the row
function roadResRetry(R) {
  const rd = R.road, nx = match && match.road && match.road.next, all = rd ? rd.got | rd.had : 7, sub = $("rRetrySub");
  const rt = !nx || all === 7 || rd.boss || !(all & 2) ? null : roadRouteOf(ROAD[rd.i], R.me.spec.id);
  const miss = !nx || all === 7 ? "" : rd.boss ? BOSS_LV[rd.lv] : !(all & 2) ? `★ ${ROAD_STARS[1]}` : `★ ${roadStarShort(ROAD[rd.i], R.me.spec.id)}`;
  $("rRetry").hidden = !miss;
  $("rRetry").parentNode.classList.toggle("retry", !!miss);
  sub.textContent = miss;
  // a narrow Retry (a small phone): "★ Lift & Smash" without the word combo, so the line is never cut
  if (rt) requestAnimationFrame(() => { if (sub.textContent === miss && sub.scrollWidth > sub.clientWidth + 1) sub.textContent = `★ ${rt.name}`; });
}
// a stop's bonus star in a few words, for Retry's second line: "Three-piece combo", "Under 60 s", "Under 2:30", "Finisher KO", "Ulti KO"
function roadStarShort(st, fid) {
  const b = st.bonus, rt = roadRouteOf(st, fid);
  return rt ? `${rt.name} combo` : b.k === "fast" ? `Under ${b.s < 100 ? `${b.s} s` : `${Math.floor(b.s / 60)}:${String(b.s % 60).padStart(2, "0")}`}` : b.k === "fin" ? "Finisher KO" : b.k === "ulti" ? "Ulti KO" : b.txt;
}
// the combo route a stop's combo star asks for ("own": the fighter you play's own route), null for the other stars
function roadRouteOf(st, fid) {
  const b = st && st.bonus;
  if (!b || b.k !== "route") return null;
  const id = b.r === "own" ? (ROUTES.OWN[fid] || {}).id : b.r;
  return ROUTES.ALL.find((r) => r.id === id) || null;
}
// the Combo trial on a stop's combo with the fighter you play; its Back (and the pause menu) return to the stop's sheet (ui/combos.js TR.back)
function roadTrial(i) {
  const me = FIG[P.last] || FIGHTERS[0], rt = roadRouteOf(ROAD[i], me.id);
  if (!rt) return;
  modal("roadStop", false);
  goFull(); startTrial(me.id, { route: rt.id, back: i });
}
// the results' big button after a win: Next stop / To <boss> after a region's last stop / To <region> after a boss win that opened it,
// Next: Hard after a boss win; Retry after a loss (menus.js rAgain does it)
function roadAgainLabel() {
  const nx = match && match.road && match.road.next;
  if (!nx) return "Retry";
  if (nx.lv !== undefined) return `Next: ${BOSS_LV[nx.lv]}`;
  if (nx.k !== undefined) return `To ${ROAD_REG[nx.k].name}`;
  return roadIsBoss(nx.i) ? `To ${roadBossSpec(nx.i - ROAD.length).name}` : "Next stop";
}
// Retry beside Next stop: the same stop, or the same boss level
function roadRetry() {
  const rd = match && match.road;
  if (!rd) return;
  if (rd.boss) roadBossFight(rd.k, rd.lv); else roadFight(rd.i);
}
function roadAgain() {
  const rd = match.road, nx = rd.next;
  if (nx && nx.lv !== undefined) roadBossFight(rd.k, nx.lv);
  else if (nx && nx.k !== undefined) openRoad({ reg: nx.k, to: roadGoesOn(roadGet(), nx.k) });
  else if (nx) openRoad({ to: nx.i });
  else if (rd.boss) roadBossFight(rd.k, rd.lv);
  else roadFight(rd.i);
}
// where region k goes on: its next stop to win, its boss once every stop is won and the fence is open (null: just show the region)
function roadGoesOn(r, k) {
  const j = roadNext(r, k);
  return j < ROAD_N ? k * ROAD_N + j : roadGateOpen(r, k) ? ROAD.length + k : null;
}
function roadResMode(R) {
  return R.road.boss ? `The Road · ${roadBossSpec(R.road.k).name} · ${BOSS_LV[R.road.lv]}` : `The Road · ${ROAD_REG[roadRegOf(R.road.i)].name} · stop ${(R.road.i % ROAD_N) + 1} · ${ROAD[R.road.i].name}`;
}

/* ----- the menu card: the map in small, "Stop 3 of 8 · 7 ★" ----- */
function roadCard() {
  const r = roadGet(), k = roadHome(r);
  $("mRoad").textContent = (k ? `${ROAD_REG[k].name} · ` : "") + roadSummary(r, k);
  requestAnimationFrame(() => roadPaint($("mRoadCv"), tick, { mini: true }));
}

$("roadBack").addEventListener("click", () => { Sfx.init(); Sfx.uiBack(); goMenu(); });
$("roadPrev").addEventListener("click", () => roadGo(-1));
$("roadNext").addEventListener("click", () => roadGo(1));
$("rsGo").addEventListener("click", () => { Sfx.init(); Sfx.uiGo(); goFull(); if (roadIsBoss(RD.sel)) roadBossFight(RD.sel - ROAD.length, RD.blv | 0); else roadFight(RD.sel); });
$("rsTeam").addEventListener("click", () => { Sfx.init(); Sfx.uiGo(); goFull(); modal("roadStop", false); sel.fighter = (FIG[P.last] || FIGHTERS[0]).id; teamUp(ROAD_REG[RD.sel - ROAD.length].boss, RD.blv | 0); });
$("rsMe").addEventListener("click", () => { Sfx.init(); Sfx.ui(); modal("roadStop", false); openSelect("road"); });   // your card: change fighter
$("rsCombo").addEventListener("click", (e) => { if (!e.target.closest(".rd-cmb")) return; Sfx.init(); Sfx.ui(); roadTrial(RD.sel); });
$("rStars").addEventListener("click", (e) => { const b = e.target.closest(".rd-stk"); if (!b) return; Sfx.init(); Sfx.ui(); roadTrial(+b.dataset.i); });
$("rsStars").addEventListener("click", (e) => { const b = e.target.closest(".rd-lvb"); if (!b) return; Sfx.init(); Sfx.ui(); rdLevel(+b.dataset.q); });
for (const id of ["rsBack", "rsClose"]) $(id).addEventListener("click", () => { Sfx.init(); Sfx.uiBack(); modal("roadStop", false); });
screens.roadStop = $("scrRoadStop");
// test hooks: the stops, the progress, start a stop or the boss, open the map, set the stars (as a synced profile would bring them)
// (boss(lv) = Old Scratch, as before; boss(lv, k) = region k's boss; region(k) shows region k; set(s, extra) also sets b / b2 / p2 ...;
// walking / pos: your fighter on the map)
window.__blRoad = { stops: ROAD, regions: ROAD_REG, get: roadGet, fight: (i) => roadFight(i), boss: (lv, k) => roadBossFight(k | 0, lv), open: openRoad, sheet: (i) => roadSheet(i),
  region: (k) => { RD.reg = k; $("roadHits").dataset.key = ""; roadHeader(); rdArrive(null); },
  get walking() { return !!RD.walk; }, get pos() { return RD.pos; },
  set: (s, extra) => { const r = roadGet(); P.road = Object.assign({}, r, { s: s.slice() }, extra || {}); saveProfile(); } };
