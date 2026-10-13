# PotatoBrawl handoff (end of session, 2026-10-13)

Read this first in the next session, then the plan doc "PotatoBrawl: Session Wrap-up and Next Plan"
(Jonny has the link; his answers to the decision table live there).

## State
- Live: https://potatobrawl.cloud (Hostinger VPS srv1519994, 187.124.173.121, Ubuntu 24.04, Node 20).
  Caddy terminates HTTPS and proxies to the game server on 127.0.0.1:8080 (systemd unit `potatobrawl`).
  Old http://187.124.173.121:8080 still answers (port 8080 is open to the world; plan says close it).
- Live build = Version 11 of the artifact build, online protocol `PROTO = 2` (ui.js). GitHub repo
  github.com/guspliffy/potatobrawl holds `index.html` (sha256 starts 388e135826d9), `three.min.js`,
  server.js, package.json, potatobrawl.service, README.md, render.yaml. GitHub is NOT linked to Claude:
  Jonny uploads files by hand. Source files (core.js, ui.js, ...) are only in this zip.
- The same VPS hosts Jonny's real-money trading bot (exchange keys on disk, bot currently stopped).
  Treat anything that adds attack surface there as a decision for Jonny.
- claude.ai artifact copy of the game: https://claude.ai/artifact/AfiBxQim1s3MhDXdCiEChi (Version 11).

## Restore in a fresh container
```
cd /home/claude && unzip -q potatobrawl-source.zip
mv potatobrawl-source/game /home/claude/blastline
mv potatobrawl-source/server /home/claude/potatobrawl
mkdir -p /home/claude/potatobrawl/public
cd /home/claude/potatobrawl && npm install          # ws only
cd /home/claude/blastline && python3 build.py && node snap.js   # expect "0 / 30" mismatches
```
build.py writes: blastline.html (artifact), test.html + online-test.html (local three.min.js, mock room),
and /home/claude/potatobrawl/public/index.html (+ three.min.js) for the server.

## File map (game/)
- core.js: deterministic sim (no Math.random/sin in sim; `trig(deg)` Taylor series; integers for angles).
  TUNE constants, STAGE, FIGHTERS (specs, moves `M(startup, active, endlag, dmg, bkb, kbg, angle, boxes, opts)`,
  palettes, look), step(), applyHit (strings, DI, finisher), land/tech, checkBlast (top line only kills when
  launched), bot (makeBot/botInput), serialize/restore/FKEYS/checksum. Exported as `BL` (also node module).
- ui.js: everything in the page: profile (localStorage `potatobrawl.profile.v1`), input (touch stick, pad, keys,
  gamepad readPad), 2D renderer (fallback), screens (menu, select = tiles + detail, online, results, pause,
  help, settings), tutorial (TUT, startTutorial/tutTick/tutDone), online lockstep (NET, PROTO, presence),
  main loop. Placeholders `/*SKINFX*/`, `/*GFX3D*/`, `/*PORTRAITS*/{}` are filled by build.py.
- gfx3d.js: three.js r128 renderer: buildRig (per-fighter costume, eyes, brows, face decal), syncRig,
  previews (select detail stage via cardArt[], online avatar), quality ladder R3.
- skinfx.js: per-skin-level effects (levels = palette index 0-3).
- shell.html: markup + CSS. net-ws.js: WebSocket shim for the standalone server (fakes room/user API).
- mock-room.js: BroadcastChannel room for two-tab tests.

## Rules that keep online play working
- Any change to core.js that can change simulation results must: stay deterministic, add new fighter fields
  to the newFighter defaults, FKEYS (serialize) and checksum, reset them where needed (ko, startSudden),
  and bump `PROTO` in ui.js. Check with `node snap.js` (0 mismatches) and `python3 pwon.py` (0 desyncs;
  needs the local server: `PORT=8091 KEEPALIVE_MINUTES=0 node server.js` in /home/claude/potatobrawl).
- No service worker (a cached old build would desync matches).
- Balance check: `node bal7.js 80 0.5,0.8` (per-fighter win rates, currently about 45-56%).

## Test scripts (game/)
snap.js (replay determinism) · bal7.js (balance, CORE=path to compare) · lockhuman.js / locktrace.js
(light-attack lock vs human-speed defender) · lockcheck2/3.js (older lock checks) · rules7*.js (DI,
breakfall, sudden death) · topsim.js / topko*.js (top-line deaths) · pwux2.py (all screens on phone,
small phone, desktop) · pwsel.py · pwtut.py (tutorial walkthrough) · pwline.py (fighter lineup renders:
`python3 pwline.py TAG PALETTE`) · pwmatch.py · pw2d.py · pwon.py (two-browser online match on the local
server). Playwright + Chromium are preinstalled in the container; 3D runs on swiftshader (slow), so
tests that need speed set gfx '2d' in the profile.

experiments/lockfix-prototype/: Fable's tested copy of core.js with the light-lock fix (`core-fix.js`,
diff vs core.js is ~20 lines: strGap 20, strSafe 30, strLaunched flag) and its checks
(maxhits.js, determinism.js, modes.js, trace.js; they read `CORE=` or /home/claude/blastline/core.js).

## Deploy
1. Jonny uploads the new `index.html` (exact name, from /home/claude/potatobrawl/public/) to the top
   level of the GitHub repo. three.min.js only if it changed. Never the artifact download (it lacks the
   WebSocket shim).
2. He pastes deploy/update.sh on the server; it must print "new version is live" (it greps for the
   current PROTO line: update that string when PROTO changes).
deploy/ also has the first-time setup block and the HTTPS (Caddy) block for reference.

## Gotchas
- `pkill -f <pattern>` kills the tool's own shell (exit 144). Kill node by pid:
  `for p in $(ps -eo pid,comm,args | awk '$2=="node" && /server.js/ {print $1}'); do kill $p; done`
- server.js caches files at start: restart it after a rebuild.
- Google Fonts are blocked in the sandbox; screenshots use fallback fonts.
- Jonny's preferences: raw findings, correctness over speed, no silent code changes, flag assumptions,
  stop and ask instead of guessing. He wants plans presented before code changes.

## Next work, in order (details in WORKFLOW.md and the plan doc)
- M0 setup: Jonny connects GitHub to Claude (Customize > Connectors > GitHub Integration, plus the Claude
  GitHub App installed on guspliffy/potatobrawl). Then move these sources into the repo (game/, tests/,
  docs/HANDOFF.md, short CLAUDE.md), split ui.js into modules with byte-identical build output, add
  check.sh (snap + online test + balance + screenshot smoke, PASS/FAIL lines), set up beta.potatobrawl.cloud.
- M1: light-attack lock fix (port experiments/lockfix-prototype, PROTO 2 -> 3) + fullscreen/home-screen app.
- M2: accounts via sync code (server endpoints, StateDirectory=potatobrawl, limits, nightly backup, close :8080).
- M3: hit-feel polish + KO finisher Phase 1.
- Then the backlog, ordered by Jonny's answers (plan doc, decision 8) and the Project's FEEDBACK doc.
