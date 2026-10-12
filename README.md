# PotatoBrawl

A 1v1 potato platform fighter that runs in the browser. Anyone with the link can play,
with no account and no install. One small Node.js process serves the page and relays
online matches.

## What is in here

| File | What it does |
|---|---|
| `public/index.html` | The game: menus, six potato fighters, CPU ranked ladder, practice, online play |
| `public/three.min.js` | three.js r128 (MIT licence), the 3D graphics library. Served from your own server, not a CDN |
| `server.js` | Serves the page, relays online matches over WebSocket (`/ws`), keeps itself awake |
| `package.json` | One dependency: `ws` (pinned to 8.21.3) |
| `render.yaml` | Render setup: free web service in Frankfurt |
| `potatobrawl.service` | For running on your own Linux server instead (systemd) |

## Put it online on Render (free)

1. **Put this folder on GitHub.** Create a new repository (private is fine), then use
   *Add file → Upload files* and drag in everything from this folder, so `render.yaml`
   sits at the top level of the repository. Commit.
2. **Create the service.** In the Render dashboard choose *New → Blueprint*, connect your
   GitHub account, pick the repository and confirm. Render reads `render.yaml` and creates
   a free web service called `potatobrawl` in Frankfurt.
3. **Wait for the first deploy** (a minute or two). Your game is then at
   `https://potatobrawl.onrender.com`, or a similar name if that one is taken. That link is
   what you send to friends.
4. **Check it's awake.** Open `https://<your-service>.onrender.com/health`. A few minutes
   after a deploy it shows the time of the last keep-alive ping.

To update the game later, replace `public/index.html` in the repository. Render redeploys
on its own after each commit.

### Graphics

The fighters and stage are drawn in 3D (WebGL). Phones that can't keep up drop to a lower
resolution and then turn off shadows on their own. If 3D isn't available at all, the game
switches to its 2D drawings. Players can also switch by hand with *Graphics: 3D / 2D* at the
bottom of the main menu or in the pause menu. Graphics never affect online play: both
browsers simulate the same game regardless of what each one draws.

### Staying awake for free

Render stops a free web service after 15 minutes without incoming traffic, and the first
visit after that takes about a minute to load. `server.js` prevents this on its own: every
4 minutes it requests its own public address (`RENDER_EXTERNAL_URL`, which Render sets),
and that request counts as incoming traffic. You don't need UptimeRobot or another outside
pinger. If you ever want one anyway, point it at `/health`; any interval under 15 minutes
works.

Things to know about Render's free plan:

- Each workspace gets 750 free instance hours per calendar month. One service running all
  month uses at most 744, so this fits only if it's your only free service in that
  workspace. When the hours run out, Render suspends free services until the next month.
- Render may restart free services at any time. Matches in progress at that moment end;
  everything else (ratings, tokens, colors) is stored in each player's own browser, so
  nothing is lost.
- To spend fewer hours, set `KEEPALIVE_MINUTES` to `0` in the service's environment
  settings. The game then sleeps when nobody plays and takes about a minute to wake up.

## How online play works

- Both players' browsers run the same game simulation in lockstep and only send stick and
  button inputs. The server never runs the game; a match is a few KB per second.
- The input delay is set from the measured ping at the start of each match: about 100 ms on
  a good connection, up to about 250 ms on a weak one.
- Every second both browsers compare a checksum of the game state. If they ever disagree,
  the host's state is sent over and the match continues.
- If a player's connection drops briefly, the server holds their seat for 8 seconds so the
  match can resume.
- The lobby shows everyone who has the page open. Treat the link like a group-chat link.

## Try it on your own computer

Needs Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:8080. Phones on the same Wi-Fi can join at
`http://<your computer's local IP>:8080`.

## Run it on your own server instead

If you move off Render later, use a separate small server, not the one running your
trading bot. On a fresh Ubuntu 24.04 machine:

```bash
apt update && apt install -y nodejs npm
adduser --system --group --no-create-home potatobrawl
mkdir -p /opt/potatobrawl          # copy this folder's files in here
cd /opt/potatobrawl && npm install --omit=dev
chown -R potatobrawl:potatobrawl /opt/potatobrawl
cp potatobrawl.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now potatobrawl
ufw allow OpenSSH && ufw allow 8080/tcp && ufw enable
```

The game is then at `http://SERVER_IP:8080`. Set `KEEPALIVE_MINUTES=0` there; a normal
server doesn't sleep.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port to listen on (Render sets its own) |
| `KEEPALIVE_MINUTES` | `4` | How often the server pings itself; `0` turns it off |
| `KEEPALIVE_URL` | Render's URL | Public address to ping, if not on Render |
| `LAG_MS` | `0` | Adds artificial delay to every message, for testing netcode |
