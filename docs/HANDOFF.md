# PotatoBrawl handoff (updated 2026-10-13, M4: 2D manga KO finishers for all six fighters)

Read this first in the next session, then the plan doc "PotatoBrawl: Session Wrap-up and Next Plan"
(https://claude.ai/code/artifact/f7e0713d-9315-4348-b861-f7c29d3c927f; Jonny's answers to the decision table live there).

## State
- Live: https://potatobrawl.cloud (Hostinger VPS srv1519994, 187.124.173.121, Ubuntu 24.04, Node 20).
  Caddy terminates HTTPS and proxies to the game server on 127.0.0.1:8080 (systemd unit `potatobrawl`,
  checkout in /opt/potatobrawl). Old http://187.124.173.121:8080 still answers (plan says close it in M2).
- PR #2 (M1 + M2: light-attack lock fix, PROTO 3, Android fullscreen, iPhone home-screen app, KO finisher
  Phase 1) was merged 2026-10-13 (9915ae6); live once Jonny pasted deploy/update.txt.
- M3 "fight feel" (branch claude/m1-dragon-lock-fullscreen-u9pkgz restarted from main, PROTO 4): heavies get
  their own look and sound, specials finish from 175% (finish mode), ground heavies charge up to 1 s, and the
  KO is decided at the hit so the finisher starts on the KO hit and launches the loser out. Plan and Fable's
  design: /mnt/project-files/fight-ideas/plan.md (Project files). Merged (PR #3, 61492cb) and live since
  2026-10-13 16:25 UTC.
- M4 (Jonny, 2026-10-13, after playing M3): matches are 2D only (he finds 2D more fun; the Graphics setting is
  gone and `use3D()` returns false), lives are red hearts, and the KO finisher becomes a live 3D film per
  fighter (three.js; the 2D picture shatters like glass into a 3D "dimension"). Plan and Fable's film design:
  /mnt/project-files/finisher-films/plan.md and fable-cinematics.md. Step 1 (2D only + hearts) = PR #4, merged
  (f4d060f). Step 2 (the film engine + Dragon "Inferno") = PR #5, merged (9ee741b).
- After playing the 3D film, Jonny (2026-10-13 19:57 UTC) asked for 2D comic/manga finishers "like Naruto", calmer,
  4-5 s, and picked "2D manga" on a decision card. Fable's design: /mnt/project-files/finisher-films/fable-manga.md.
  The manga engine (ui/manga.js) and all six pages (manga/<id>.js) are this PR; videos:
  finisher-films/<fighter>-<title>-manga-v1.mp4. The 3D films are switched off (three.js never loads); the five
  unfinished 3D films are saved as patches in finisher-films/3d-wip/.
- PR #6 (bigger Heavy/Special buttons with a jump boost, rating + chips top right, tutorial vs an Easy CPU with a
  charge step) merged (c0fe65c).
- Source lives in this repo since M0 (no more zip). GitHub is connected to Claude; Claude works on a branch
  and opens a pull request. Claude merges its own PRs once ./check.sh passes (Jonny's standing rule since
  2026-10-13); deploying stays Jonny's paste.
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
  look), step(), applyHit (strings, DI, finish mode, charge), land/tech, checkBlast, bot (makeBot/botInput),
  serialize/restore/FKEYS/checksum. Exported as `BL` (also a node module).
  - Finish mode: a move or projectile with a `fin` block (all six specials) uses those numbers when the
    defender had >= TUNE.finishPct (175) before the hit; hitstop TUNE.finishStop; "hit" event `fin: true`.
  - Charge: moves with `charge` (ground hSide/hUp/hDown) wait at mt = startup - chgHold while heavy is held;
    `f.chg` 0..chgMax (60); +chgDmg/+chgKb at full; no armour while waiting; event "chargeMax".
  - KO at the hit: every launching hit (tumble) is checked by `lethal()`: serialize, then play lookFrames (360)
    frames on a scratch game (`g.look` stops recursion) with the defender trying four escapes
    (`escapeInput`); lethal only if all four die. Event "lethal" {slot, by, final, mv, fin, chg, kb, dirx,
    diry}. On the last life (`final`) the loser is `doomed` (intangible, KO counted at once) and endGame runs
    on that frame ("game" event `hit: true`); the blast line later only removes the doomed loser.
- ui/: one script in 11 parts, joined in order by build.py (UI_PARTS); base.js opens the IIFE and loop.js
  closes it, so a part alone is not valid JS.
  base (profile in localStorage `potatobrawl.profile.v1`, tiers, sound) · input (touch stick, pad, keys,
  gamepad) · view (layout, camera, colors) · draw-fighters (2D fighters) · draw-world (2D stage, projectiles)
  · effects (fx, /*SKINFX*/ and /*GFX3D*/ placeholders, render, sim events) · screens (menu, select, match,
  results) · online (NET, PROTO, lockstep, presence) · menus (button wiring, settings, help) · tutorial
  · loop (simTick, frame).
- ui/finisher.js (between effects and screens): KO finisher cinematic, started by the final lethal hit (no
  finisher for a self-destruct or a failed recovery). Beat 0 is the real impact, then the staged scene ends
  with the loser launched out of the arena. Also the KO zoom on earlier lives (finLethal), the finishing-
  special band (finHit) and the FINISH! / charge feedback helpers. Pure UI: two stand-in fighters
  ("puppets", copies with state "fin" and a finPose hook that pose() calls), its own camera (cam.yaw swings
  the 3D camera), particles and shapes on the effects layer, name card, skip, and it holds the results
  screen (finHold) until it ends. Timeline constants FT; one entry per fighter in FINS.
- cine.js (spliced at /*CINE*/ after /*GFX3D*/ in effects, together with vendor/three-addons.js and films/*.js):
  the KO films, live three.js cutscenes. finStart calls cineStart; when the winner has a film in FILMS and the
  film is warmed up, FIN.cine is set and cineTick/cineDraw/cineOverlay take over from the 2D staging: crack web
  over the 2D hit, the 2D picture as a pane that shatters, the 3D film, shutters, results (~4.2 s). Anything
  missing (no WebGL, three.js not loaded yet, a fighter without a film yet, a failure) plays the 2D finisher.
  three.js now loads in the background (cineLoadThree, page idle) instead of a blocking script tag; warm-up
  (both hero rigs, set, env map, shader compile) runs in steps during the match countdown (cineIdle). Tiers
  A/B/C (window.__cineTier pins one in tests). Pure UI: never writes G. Films so far: films/dragon.js.
- ui/manga.js (after finisher.js; manga/*.js spliced at its /*MANGA*/ marker, sorted): the KO finisher as a manga page.
  finStart plays MANGA[winner] before anything else: the real hit, the frozen frame inked (paper tint, dot tone,
  border, focus lines, sound word), panels sliding in over each other (the old ones stay visible), a face inset, the
  strike with a 120 ms drop and two impact frames, the loser tearing through the border along the real launch
  direction, the title block with the K.O. seal, results at 4720 ms, skip from 1000 ms. Timeline MT; a page is
  data + small functions (MANGA.<id>: panels(lay), words(lay), build, start, step, pose, impact, ...; dragon.js is
  the template). Puppets via mgPuppet, faces via P.expr in draw-fighters.js (terror grin rage calm dazed ko).
  The Cin sound kit lives here now. Any throw falls back to the 2D finisher (FINS). Pure UI: never writes G.
- gfx3d.js the old 3D match renderer (unused since M4 step 1; its rigs feed the films) · skinfx.js skin effects · shell.html markup + CSS · net-ws.js WebSocket
  shim (server build only) · mock-room.js two-tab test room · portraits/ (portraits.json is what's inlined).
- make-icons.py writes the home-screen icons into web/ (repo root) from portraits/phoenix.jpg.
- web/ (repo root): manifest.webmanifest + icons. server.js serves them from public/ if present; build.py and
  the deploy blocks copy them there.
- Fullscreen helpers (FS, goFull, leaveFull) live in ui/input.js next to touchUI; the Fullscreen setting is
  P.fs (undefined = on for touch devices); the iPhone tip is dismissed with P.a2hs.

## Rules that keep online play working
- A core.js change that can change simulation results must stay deterministic, add new fighter fields to
  the newFighter defaults, FKEYS and checksum, reset them where needed (ko, startSudden), bump `PROTO` in
  game/ui/online.js and the grep line in deploy/update.txt (check.sh checks they match).
- No service worker (a cached old build would desync matches).
- Balance band in check.sh is 44-57% (M3: phoenix 49.1, alchemist 45.8, odin 53.8, wizard 48.1, samurai 49.9,
  dragon 53.4; bots now charge sometimes and go for the special when the opponent is finish-ready).

## Tests (tests/, run from anywhere)
snap.js (replay determinism) · bal7.js (balance; CORE=path compares another core) · lockrun.js (longest
unreactable jab run, check.sh wants <= 3 at R=14) · lockdet.js (save/restore while string launches happen) ·
finish.js (finish mode per fighter and weight, charge frame data, every lethal call in 30 bot matches ends
in that KO; check.sh step 3c) · pwfin.py (KO finisher per fighter from a real lethal hit; --2d, --up, --skip,
--self = self-destruct plays no finisher, --aim=left/up, WxH; steps requestAnimationFrame and
performance.now itself for screenshots) · pwfinish.py (FINISH! state, finishing special, KO zoom, charge
ring) · pwheavy.py (contact sheets of lights vs heavies) · pwmanga.py (the manga KO pages: --fighter --vs --at
WxH --up --aim --skip --reduced --sheet --throttle --video; prints the page's draw ms) · pwcine.py (the old 3D KO films: freeze frames
at chosen ms, --tier, --nogl, --skip, --sheet, --video=out.mp4 steps the film at 30 fps and encodes with ffmpeg) · lockhuman.js /
locktrace.js (light-attack lock vs human-speed defender) · lockcheck2/3.js (older) · rules7*.js (DI,
breakfall, sudden death) · topsim.js / topko.js (top-line deaths) · pwux2.py (all screens, 3 sizes) ·
pwsel.py · pwtut.py · pwline.py · pwmatch.py · pw2d.py · pwon.py (two-browser online match, needs
`PORT=8091 KEEPALIVE_MINUTES=0 node server.js`). Playwright scripts load build/test.html and write
screenshots into the current directory (check.sh uses build/shots/).
pwon.py now also asks both browsers for a rematch after the KO (prints "rematch ok").
experiments/lockfix-prototype/ was removed once the fix went into core.js (its checks are lockrun/lockdet).

## Deploy
- Live: Claude merges the pull request once all checks pass, then Jonny pastes deploy/update.txt on the server
  (always the current file: an old saved copy checks an old PROTO); it must print
  "new version is live". No more file uploads. Since M1 the block also copies web/* (manifest, icons).
- Beta (once set up): deploy/beta-update.txt with BRANCH set to the branch to try.

## Gotchas
- `pkill -f <pattern>` kills the tool's own shell. Kill node by pid:
  `for p in $(ps -eo pid,comm,args | awk '$2=="node" && /server.js/ {print $1}'); do kill $p; done`
- server.js caches files at start: restart it after a rebuild.
- Google Fonts are blocked in the sandbox; screenshots use fallback fonts.
- Jonny's preferences: raw findings, correctness over speed, no silent code changes, flag assumptions,
  stop and ask instead of guessing, plan before code changes, session conclusion + next plan at the end.

## Next work, in order
On 2026-10-13, after playing M1 + M2, Jonny asked for special finishes, Mortal-Kombat-style finishers, heavies
that differ from lights, a charged heavy, and the finisher starting on the KO hit. He chose to do this before
accounts (1 s charge).
- M3 fight feel: live; Jonny's phone test (sounds) still pending.
- M4 now: 2D manga KO finishers for all six (this PR). Next: Jonny's notes on the videos, a real-phone check of the
  page's draw time (budget 6 ms/frame), then remove the 3D code (gfx3d.js, cine.js, films/, vendor/, three.min.js;
  the deploy block copies three.min.js, so drop it there in the same change).
- M4 history (finisher-films/plan.md): 1. 2D only + red hearts (display only). 2. The 3D film engine + the
  Dragon's "Inferno" film, sent to Jonny as a video before the rest. 3. The other five films (Phoenix, then
  Wizard + Alchemist, then Odin + Samurai). UI only, no PROTO bump. The Potatalities move to a later finisher
  shop that sells alternates for chips (the existing currency) next to the skins.
- M5: accounts via sync code (server endpoints, StateDirectory=potatobrawl, limits, nightly backup, close
  :8080). Still needs Jonny's answers to plan-doc decisions 3 and 5.
- Then hit-feel polish, finisher Phase 3 (bloom on strong phones, music stingers), upgraded finishers for top
  skins.
- Then the backlog, ordered by Jonny's answers (plan doc, decision 8) and the Project's FEEDBACK doc.
