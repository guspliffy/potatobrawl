# PotatoBrawl

1v1 platform fighter (browser, phone + desktop) with lockstep online play. Live at https://potatobrawl.cloud.
Read docs/WORKFLOW.md (how we work) and docs/HANDOFF.md (state, rules, next steps) before starting.

## Layout
- `game/` source. `core.js` deterministic simulation (exported as `BL`, also a node module); `ui/*.js` page logic (one script split into parts, joined in order by build.py; PROTO lives in `ui/online.js`);
  `ui/cup.js` the offline 8-player tournament (bracket screen, P.cup; UI only); `ui/acct.js` + `sync.js` profile pill, Account sheet and sync code (UI only; `sync.js` is the pure merge, also a node module); `ui/hud.js` match HUD extras: the YOU/CPU marker fade and the danger edge glow (UI only, reads the sim, never writes it); `ui/finisher.js` KO finisher cinematic (UI only, never touches the sim); `ui/manga.js` + `manga/*.js` the 2D manga KO finisher pages, one per fighter (UI only; the Gunslinger has none yet, his KO plays the 2D finisher); `skinfx.js` skin effects; `shell.html` markup + CSS; `net-ws.js` WebSocket
  shim for the server build; `mock-room.js` two-tab test room; `portraits/`.
- `python3 game/build.py` writes `index.html` (repo root, the deployed file), `public/` (local server) and
  `build/` (test pages). Commit the rebuilt `index.html` together with the source change.
- `web/` manifest + icons for the home-screen app (copied into `public/` by build.py and the deploy blocks).
- `three.min.js` (repo root) is not loaded by anything any more; build.py and the deploy blocks still copy it. Drop it in one change next round.
- `server.js` serves `public/` + WebSocket rooms; `accounts.js` the optional sync-code accounts (off unless `ACCOUNTS_DIR` is set). `deploy/` holds the server paste blocks.
- `tests/` node + Playwright checks, `experiments/` prototypes not yet in the game.

## Rules
- core.js must stay deterministic (no Math.random / Math.sin in the sim). A change that can alter simulation
  results adds new fighter fields to defaults, FKEYS and checksum, and bumps `PROTO` in ui/online.js (and the PROTO line in deploy/update.txt).
- No service worker. Anything that adds ports, stored data or dependencies on the VPS is Jonny's call
  (it also runs his trading bot).
- Present a plan to Jonny before changing game code.
