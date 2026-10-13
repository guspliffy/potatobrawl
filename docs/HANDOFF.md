# PotatoBrawl handoff (updated 2026-10-13, end of M0)

Read this first in the next session, then the plan doc "PotatoBrawl: Session Wrap-up and Next Plan"
(https://claude.ai/code/artifact/f7e0713d-9315-4348-b861-f7c29d3c927f; Jonny's answers to the decision table live there).

## State
- Live: https://potatobrawl.cloud (Hostinger VPS srv1519994, 187.124.173.121, Ubuntu 24.04, Node 20).
  Caddy terminates HTTPS and proxies to the game server on 127.0.0.1:8080 (systemd unit `potatobrawl`,
  checkout in /opt/potatobrawl). Old http://187.124.173.121:8080 still answers (plan says close it in M2).
- Live build = Version 11, online protocol `PROTO = 2` (game/ui/online.js), index.html sha256 388e135826d9.
- Source lives in this repo since M0 (no more zip). GitHub is connected to Claude; Claude works on a branch
  and opens a pull request, Jonny merges.
- Beta: deploy/beta-setup.txt sets up https://beta.potatobrawl.cloud (127.0.0.1:8081). Not run yet unless
  Jonny says so.
- The same VPS hosts Jonny's real-money trading bot (exchange keys on disk). Anything that adds attack
  surface there is Jonny's decision.

## Working in a fresh container
```
npm install                                   # ws only
python3 -m pip install playwright==1.56.0     # matches the preinstalled Chromium 1194
./check.sh --quick                            # build + PROTO + replay, seconds
./check.sh                                    # everything, ~5 min (screens on swiftshader are slow)
```
`python3 game/build.py` writes index.html (root, deployed), public/ (local `node server.js`) and build/
(blastline.html = artifact copy, test.html, online-test.html). build/ and public/ are git-ignored;
index.html is committed with every source change (check.sh flags a stale one).

## File map (game/)
- core.js: deterministic sim (no Math.random/sin in sim; `trig(deg)` Taylor series; integer angles).
  TUNE, STAGE, FIGHTERS (moves `M(startup, active, endlag, dmg, bkb, kbg, angle, boxes, opts)`, palettes,
  look), step(), applyHit (strings, DI, finisher), land/tech, checkBlast, bot (makeBot/botInput),
  serialize/restore/FKEYS/checksum. Exported as `BL` (also a node module).
- ui/: one script in 11 parts, joined in order by build.py (UI_PARTS); base.js opens the IIFE and loop.js
  closes it, so a part alone is not valid JS.
  base (profile in localStorage `potatobrawl.profile.v1`, tiers, sound) · input (touch stick, pad, keys,
  gamepad) · view (layout, camera, colors) · draw-fighters (2D fighters) · draw-world (2D stage, projectiles)
  · effects (fx, /*SKINFX*/ and /*GFX3D*/ placeholders, render, sim events) · screens (menu, select, match,
  results) · online (NET, PROTO, lockstep, presence) · menus (button wiring, settings, help) · tutorial
  · loop (simTick, frame).
- gfx3d.js three.js r128 renderer · skinfx.js skin effects · shell.html markup + CSS · net-ws.js WebSocket
  shim (server build only) · mock-room.js two-tab test room · portraits/ (portraits.json is what's inlined).

## Rules that keep online play working
- A core.js change that can change simulation results must stay deterministic, add new fighter fields to
  the newFighter defaults, FKEYS and checksum, reset them where needed (ko, startSudden), bump `PROTO` in
  game/ui/online.js and the grep line in deploy/update.txt (check.sh checks they match).
- No service worker (a cached old build would desync matches).
- Balance band in check.sh is 44-57% (samurai sits at 56.5% on the live build).

## Tests (tests/, run from anywhere)
snap.js (replay determinism) · bal7.js (balance; CORE=path compares another core) · lockhuman.js /
locktrace.js (light-attack lock vs human-speed defender) · lockcheck2/3.js (older) · rules7*.js (DI,
breakfall, sudden death) · topsim.js / topko.js (top-line deaths) · pwux2.py (all screens, 3 sizes) ·
pwsel.py · pwtut.py · pwline.py · pwmatch.py · pw2d.py · pwon.py (two-browser online match, needs
`PORT=8091 KEEPALIVE_MINUTES=0 node server.js`). Playwright scripts load build/test.html and write
screenshots into the current directory (check.sh uses build/shots/).
experiments/lockfix-prototype/: Fable's tested core.js with the light-lock fix (`core-fix.js`, ~20 lines
diff: strGap 20, strSafe 30, strLaunched flag) and its checks (CORE= or ../../game/core.js).

## Deploy
- Live: Jonny merges the pull request on GitHub, then pastes deploy/update.txt on the server; it must print
  "new version is live". No more file uploads.
- Beta (once set up): deploy/beta-update.txt with BRANCH set to the branch to try.

## Gotchas
- `pkill -f <pattern>` kills the tool's own shell. Kill node by pid:
  `for p in $(ps -eo pid,comm,args | awk '$2=="node" && /server.js/ {print $1}'); do kill $p; done`
- server.js caches files at start: restart it after a rebuild.
- Google Fonts are blocked in the sandbox; screenshots use fallback fonts.
- Jonny's preferences: raw findings, correctness over speed, no silent code changes, flag assumptions,
  stop and ask instead of guessing, plan before code changes, session conclusion + next plan at the end.

## Next work, in order
- M1: light-attack lock fix (port experiments/lockfix-prototype, PROTO 2 -> 3) + fullscreen on Android +
  home-screen app on iPhone.
- M2: accounts via sync code (server endpoints, StateDirectory=potatobrawl, limits, nightly backup, close :8080).
- M3: hit-feel polish + KO finisher Phase 1.
- Then the backlog, ordered by Jonny's answers (plan doc, decision 8) and the Project's FEEDBACK doc.
