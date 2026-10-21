# PotatoBrawl

A platform fighter for phones and desktops, played in the browser: eight potato fighters in 1v1 and 2v2 matches, CPU
bosses, a Road of stops, a tournament and a Daily Potato. Online play is lockstep: both browsers run the same
simulation and only exchange inputs. Live at https://potatobrawl.cloud.

Read `CLAUDE.md` (the file map and the rules), `docs/WORKFLOW.md` (how we work) and `docs/HANDOFF.md` (state and next steps)
before changing anything.

## Layout

- `game/` is the source: `core.js` (the deterministic simulation, also a node module), `ui/*.js` (the page logic, joined
  into one script), `css/`, `shell.html` (markup), `net-ws.js` (the WebSocket layer for the server build) and `build.py`.
  `CLAUDE.md` has the full list.
- `index.html` (repo root) is the built page that gets deployed. Commit it together with every source change.
- `server.js` serves `public/` and relays online matches over WebSocket (`/ws`); `accounts.js`, `quick.js`, `cpurank.js`
  and `stats.js` are the optional parts it loads (below).
- `web/` holds the home-screen app files (manifest, icons), `tests/` the node and Playwright checks, `deploy/` the blocks
  Jonny pastes on the server.
- `potatobrawl.service` is the systemd unit. `render.yaml` is left from the first free-host setup: the live game runs on
  the VPS below.

## Build

```bash
python3 game/build.py
```

It writes `index.html`, `public/` (what a local `node server.js` serves) and `build/` (test pages, not committed).

## Run it locally

Needs Node.js 18 or newer and one dependency, `ws` (pinned in `package.json`).

```bash
npm install
python3 game/build.py
node server.js        # http://localhost:8080
```

The server reads the page and the other files once at start-up, so restart it after a build. All settings are
environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port to listen on |
| `HOST` | all addresses | Address to listen on (the VPS uses `127.0.0.1`, behind Caddy) |
| `ACCOUNTS_DIR` | off | Folder for the sync-code accounts. Off unless it exists and is writable |
| `STATS_DIR` | off | Folder for the anonymous play counts. Off unless it exists and is writable |
| `KEEPALIVE_MINUTES` | `4` | How often the server requests its own public address; `0` turns it off |
| `KEEPALIVE_URL` | none | The address to request (only used when set); a server on a normal host needs neither |
| `LAG_MS` | `0` | Adds artificial delay to every message, for testing netcode |
| `QM_T`, `CPU_T` | none | Tests only: shorter waits in Quick match and Ranked vs CPU (JSON) |

`/health` answers `ok` with the number of players online, the Ranked matches running and the last keep-alive.

## What the server does besides relaying

- **Accounts** (`accounts.js`, needs `ACCOUNTS_DIR`): optional. A sync code instead of a password carries a profile
  to another device. One small JSON file per account, named after the SHA-256 of the code (the code itself is never
  stored). Without it the Account sheet says saving isn't available.
- **Quick match and Ranked** (`quick.js`): one queue for Ranked and Casual 1v1 against real players. The server is the
  referee: it replays the inputs passing through it with `core.js` and decides every Ranked match itself, so a phone
  can't change a result or the rating. The online rank is kept in the account file, so Ranked needs accounts; Casual
  works without them.
- **Ranked vs CPU** (`cpurank.js`, needs accounts): the server deals each ranked CPU match, then replays the player's
  logged inputs with `core.js` before the CPU rank moves. It also keeps the Boards (CPU rank, online rank).
- **Play counts** (`stats.js`, needs `STATS_DIR`): anonymous totals per day, no player ID, IP address or cookie. Jonny's
  private page is `/stats#<key>`; the key is made on first start and kept in `STATS_DIR/key`. The game stops sending
  when the counter is off, on Global Privacy Control, or after Settings > Play counts > Off.

## The live server

A Hostinger VPS (Ubuntu 24.04, Node 20) that also runs Jonny's trading bot, so anything that adds ports, stored data or
dependencies there is his call. The checkout is `/opt/potatobrawl`, run by the systemd unit `potatobrawl`
(`server.js` on 127.0.0.1:8080); Caddy in front serves HTTPS for `potatobrawl.cloud`. Everything is done by pasting a block
from `deploy/` as root (`deploy/README.txt` lists them):

- **Deploy:** after a pull request is merged, paste `deploy/update.txt`. It pulls `main`, copies `index.html` and `web/*` into
  `public/`, waits up to 5 minutes for running Ranked matches to finish, restarts the game and checks that the served page is
  the one from GitHub.
- **Check:** `deploy/check.txt` only reads. It compares the server with GitHub and shows whether accounts and play counts are
  on.
- **One-time setups:** `deploy/accounts-setup.txt` (accounts folder, nightly backup kept 14 days),
  `deploy/stats-setup.txt` (play counts and the stats link), `deploy/beta-setup.txt` and `deploy/beta-update.txt`
  (a test copy at https://beta.potatobrawl.cloud), `deploy/first-setup.txt` (a new server).

## Tests

```bash
./check.sh            # everything, about 20 minutes: build, replays, simulations, server tests, the browser checks
./check.sh --quick    # build, PROTO, replay, lock, finish, routes, ultimates, bosses, 2v2 only (seconds)
```

It prints one PASS or FAIL line per check and writes details to `build/check-logs/` and screenshots to `build/shots/`.
`CHECK_JOBS` and `PORT_BASE` are in its header. It needs node, python3, `npm install` and Python Playwright 1.56 matching
the installed Chromium (`python3 -m pip install playwright==1.56.0`). A single browser test runs on its own after a build, e.g.
`cd build/shots && python3 ../../tests/pwfs.py fs`.

## Rules that matter

- `core.js` must stay deterministic (no `Math.random` or `Math.sin` in the simulation). A change that can alter results
  adds the new fighter fields to the defaults, `FKEYS` and the checksum, and bumps `PROTO` in `game/ui/online.js`.
- There is no service worker.
