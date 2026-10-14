# PotatoBrawl handoff (updated 2026-10-14: combos + Daily Potato, PROTO 7)

Read this first in the next session, then the plan doc "PotatoBrawl: Session Wrap-up and Next Plan"
(https://claude.ai/code/artifact/f7e0713d-9315-4348-b861-f7c29d3c927f; Jonny's answers to the decision table live there).

## State
- Live: https://potatobrawl.cloud (Hostinger VPS srv1519994, 187.124.173.121, Ubuntu 24.04, Node 20).
  Caddy terminates HTTPS and proxies to the game server on 127.0.0.1:8080 (systemd unit `potatobrawl`,
  checkout in /opt/potatobrawl). Old http://187.124.173.121:8080 still answers (deploy/accounts-setup.txt closes it).
- PR #2 (M1 + M2: light-attack lock fix, PROTO 3, Android fullscreen, iPhone home-screen app, KO finisher
  Phase 1) was merged 2026-10-13 (9915ae6); live once Jonny pasted deploy/update.txt.
- M3 "fight feel" (branch claude/m1-dragon-lock-fullscreen-u9pkgz restarted from main, PROTO 4): heavies get
  their own look and sound, specials finish from 175% (finish mode), ground heavies charge up to 1 s, and the
  KO is decided at the hit so the finisher starts on the KO hit and launches the loser out. Plan and Fable's
  design: /mnt/project-files/fight-ideas/plan.md (Project files). Merged (PR #3, 61492cb) and live since
  2026-10-13 16:25 UTC.
- M4 (Jonny, 2026-10-13, after playing M3): matches are 2D only (he finds 2D more fun; the Graphics setting is
  gone), lives are red hearts, and the KO finisher became a live 3D film per
  fighter (three.js; the 2D picture shatters like glass into a 3D "dimension"). Plan and Fable's film design:
  /mnt/project-files/finisher-films/plan.md and fable-cinematics.md. Step 1 (2D only + hearts) = PR #4, merged
  (f4d060f). Step 2 (the film engine + Dragon "Inferno") = PR #5, merged (9ee741b).
- After playing the 3D film, Jonny (2026-10-13 19:57 UTC) asked for 2D comic/manga finishers "like Naruto", calmer,
  4-5 s, and picked "2D manga" on a decision card. Fable's design: /mnt/project-files/finisher-films/fable-manga.md.
  The manga engine (ui/manga.js) and all six pages (manga/<id>.js) are this PR; videos:
  finisher-films/<fighter>-<title>-manga-v1.mp4. The 3D code (gfx3d.js, cine.js, films/, vendor/three-addons.js,
  the GL canvases, tests/pwcine.py) was removed in the night clean-up (index.html 1142072 -> 912772 bytes); the five
  unfinished 3D films stay saved as patches in finisher-films/3d-wip/ (not in the repo). three.min.js was removed from the
  repo, build.py, server.js and the deploy blocks in one change (round after the clean-up).
- Night track (branch night-gun, PROTO 5): the Gunslinger, a seventh fighter ("Sharpshooter": Twin Shot, two weak fast
  shots, 0.8 s cooldown; Fan the hammer with a recoil hop; High Noon, one golden finishing bullet; Powder jump).
  Jonny's picture: /mnt/project-files/overnight/concept-gunslinger.jpg, Fable's design: overnight/fable-ideas.md
  section 5. His manga KO page is "High Noon" (manga/gunslinger.js, branch night-gunpage): the clock strikes twelve, a
  tumbleweed rolls by, a barrel-view inset of the loser, the draw in one frame, BANG and one smoking line, the loser's
  hat (a sprout for the hatless) floats down onto the page, he blows the smoke off the barrel. Accent sunset red;
  video finisher-films/gunslinger-high-noon-manga-v1.mp4 + -sheet.jpg. His fighter video and move sheet:
  overnight/gunslinger-v1.mp4, gunslinger-v1-sheet.jpg.
- Reaper (2026-10-14, branch claude/project-thread-a05g58, PROTO 6): the eighth fighter ("Soul harvester"), from Jonny's
  picture /mnt/project-files/overnight/concept-reaper.jpg; plan doc https://claude.ai/code/artifact/7e8b5d81-2755-4cba-9581-2e0bae5f3458.
  Weight 104, run 5.6 (5.4 failed lockrun: a faster runner caught him jab after jab), gravity 0.56, one air jump,
  glide recovery (the same `rec.glide` drift as Phoenix/Dragon; no new float mechanic). Heavies carry `scythe: true`
  (UI only) and hit in front AND behind (a second box at negative x). Harvest = a slow `kind: "dash"` special
  (speed 8) whose hit angle 160 points back at him (a tug); its `fin` block (12/12/17, angle 80) is Last Rites,
  which KOs every weight out the TOP from 175% (tests/finish.js). CPU style in BOT_STYLES. Look: hood + sprouts +
  scythe in draw-fighters.js, a white reach crescent while a ground heavy charges, skinfx, portrait, FINS.reaper
  fallback, FIN_NAME "Last Rites". Manga page "Last Rites" (manga/reaper.js): the one inverted page (near-black,
  white ink, candle amber on cheeks and soul), shadow stretching up, smirk inset, one white SHHK stroke, soul out
  through the top border, a tombstone with R.I.P. and the loser's name; manga.js got four small hooks (page(c,t),
  hint(t), mgPuppet o.mono, panel dim colour) that other pages don't use. Videos:
  /mnt/project-files/reaper-hub/reaper/reaper-v1.mp4, reaper-hub/manga/reaper-last-rites-manga-v1.mp4.
  tests/pwreel.py records a captioned move reel for any fighter (--fighter=id).
  Alchemist in the same PR: Toxic Orb cooldown 120 -> 105 frames, CPU style spec 1.7 -> 1.4.
- Combos + Daily Potato (2026-10-14, branch claude/combos-daily-potato-ix1z7e, PROTO 7), session 1 of the big-features plan
  (https://claude.ai/code/artifact/52412947-3a3c-4d13-80ae-8e441903fd1b). Wrap-up: /mnt/project-files/combos-daily/wrap-up.md.
  - The link (core.js): the 2nd light hit in a row gives +TUNE.linkStun (8) hitstun and opens `f.link` = TUNE.linkWin (12) frames
    for the attacker. While it is open the light's end lag cancels into a heavy, the special or a jump, and that heavy/special
    starts at mt = min(TUNE.linkFast 6, startup - 1) (a chargeable heavy at its charge frame), flagged `f.lk` ("hit" event `lk`).
    `heavyOrSpecial()` is the shared ground/air pick. New fighter fields `link`, `lk` (defaults, ko, startSudden, FKEYS, checksum).
    Combo damage scaling: from the 4th hit of a combo x TUNE.comboK4 (0.85), from the 6th x comboK6 (0.7). "hit" events carry
    `mi` (the move instance = moveT; projectiles -1) so the UI can count a multi-hit move once.
  - Routes: game/routes.js (pure, node module, spliced at /*ROUTES*/ in ui/combos.js): 5 shared (Three-piece, Lift & Smash,
    Trip & Spike, Rising, Signature) + 1 per fighter = 13. Keys are move ids (jab side up down nair hSide hUp hDown hAir spec;
    "!" = charged heavy; "jump" is a display-only step); `pct` = the CPU's damage in the trial (Rising 30, Skyburn 70, others 0).
    `ROUTES.track(t, e, fid)` follows a combo's hits and returns the longest route it ends with. Fable's first routes needed
    four changes to land on every fighter (Three-piece jab jab side; Rising side up jump nair; Skyburn up up jump hAir; Reap
    down down spec); names kept, hints rewritten by Fable.
  - ui/combos.js: the route name on the combo pop-up (gold, a chime when a new route is made), the Combos part of How to play
    (the link in one line, fighter chips, route cards with keys in the button colours, a count), and the Combo trial: the
    tutorial's engine (match.trial) with a CPU that stands still 70 px in front at the route's damage (always Odin, the
    fighter tests/combos.js checks every route on; Odin trains against Odin in another skin); keys light up as hits
    land, a hint after 3 misses, Next / Exit, `P.routes` (cleared ids). All 13 = the title Combo Potato (ACT in acct.js) and
    30 chips once (`P.comboPaid`). Both sync (sync.js: routes = union, comboPaid = paid anywhere). Test hook
    `window.__blastline.trial`; `window.__blInput(G)` (input.js) lets a test script drive player 1 in any match.
  - Daily Potato (ui/daily.js, UI only): a hash of the local date picks both fighters, the CPU's name and the seed (same
    matchup for everyone that day); CPU strength Mon 0.45 ... Sun 0.87 in equal steps (Normal Mon-Wed, Hard Thu-Sat, Brutal Sun);
    3 lives, 3 min, one try (starting writes the day as tried, so a reload or quit is a loss). Win +40 chips and streak +1, draw
    +15 (streak kept), finished loss +5, forfeit 0; any loss ends the streak; best streak kept. `P.daily` {d, r, s, w, b} synced
    (sync.js cleanDaily + mergeProf: the later day, a finished try over a running one, then the newer side; best = max). The
    streak shows on the profile pill (flame) while its last day is today or yesterday. Menu button between Ranked and
    Tournament with today's matchup; the sheet `#scrDaily`; results "Menu" instead of Rematch.
  - CPU styles: Alchemist spec 1.3 heavy 1.25, Gunslinger spec 1.3 heavy 1.2 (styled CPUs link specials now; botstyle was
    above 65% at the old numbers).
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
  look), step(), applyHit (strings, DI, finish mode, charge), land/tech, checkBlast, bot (makeBot(level, style)/botInput; BOT_STYLES = one style per fighter id, a few numbers
  that bias the bot's decisions; no style = the neutral bot, input for input as before),
  serialize/restore/FKEYS/checksum. Exported as `BL` (also a node module).
  - Finish mode: a move or projectile with a `fin` block (all eight specials) uses those numbers when the
    defender had >= TUNE.finishPct (175) before the hit; hitstop TUNE.finishStop; "hit" event `fin: true`.
    `proj.finCount` / `proj.finStyle` (Gunslinger only): fired against a finish-ready opponent the special
    spawns finCount projectiles drawn as finStyle (one "gold" bullet); decided at the start of the move and
    kept in the fighter field `finShot` (defaults, FKEYS, checksum). Specials without finCount are unchanged.
  - Charge: moves with `charge` (ground hSide/hUp/hDown) wait at mt = startup - chgHold while heavy is held;
    `f.chg` 0..chgMax (60); +chgDmg/+chgKb at full; no armour while waiting; event "chargeMax".
  - KO at the hit: every launching hit (tumble) is checked by `lethal()`: serialize, then play lookFrames (360)
    frames on a scratch game (`g.look` stops recursion) with the defender trying four escapes
    (`escapeInput`); lethal only if all four die. Event "lethal" {slot, by, final, mv, fin, chg, kb, dirx,
    diry}. On the last life (`final`) the loser is `doomed` (intangible, KO counted at once) and endGame runs
    on that frame ("game" event `hit: true`); the blast line later only removes the doomed loser.
- ui/: one script in 18 parts, joined in order by build.py (UI_PARTS; daily after cup, combos after menus so acct.js's titles can read it); base.js opens the IIFE and loop.js
  closes it, so a part alone is not valid JS.
  base (profile in localStorage `potatobrawl.profile.v1`, tiers, sound) · input (touch stick, pad, keys,
  gamepad) · view (layout, camera, colors) · draw-fighters (2D fighters) · draw-world (2D stage, projectiles)
  · effects (fx, /*SKINFX*/ placeholder, the frame-time watchdog PERF, render, sim events) · screens (menu, select, match,
  results; CPU_NAMES + the CPU's name under its HUD card) · hud (match HUD extras, below) · online (NET, PROTO, lockstep, presence) · menus (button wiring, settings, help) · tutorial
  · loop (simTick, frame).
- ui/cup.js (after screens): the offline tournament, UI only. You + 7 CPUs (potato names, fighters, ratings seeded around yours:
  quarter-final opponent about -30, semi-final opponent from the other quarter in your half about +40, final opponent from the other
  half about +150), quarter-final 2 lives / 2 min, semi-final 2 lives / 2 min, final 3 lives / 3 min. CPU strength from the opponent's
  rating as in ranked (d = (rating - 750) / 1000), each CPU plays its fighter's style. The cup lives in `P.cup` (seats 0-7, `p` = the
  seats still in each round, `round`, `out`, `earned`; saved with the profile, so a reload returns to the bracket; a match that was
  running at the reload is simply fought again). The other matches of a round are decided when you finish yours, by Elo odds and the
  cup's seed (cupDecide), and tick in on the bracket one by one. Chips 15 / 25 / 60 per round won, +30 for a cup won without losing a
  life, added to `P.tokens`; no rating, record or history change; `P.cups` counts cups won (you only write it). Pause > Forfeit or a
  lost match ends the cup (the rest of it is played out so a champion shows); "Run it back" starts a new cup with the same fighter;
  Menu in a running cup asks before leaving. Hooks outside the file: screens.js (`show`, openSelect text for the "cup" mode,
  togglePause texts, finishMatch -> cupMatchEnd, vsLine), menus.js (bCup, selGo, pQuit), shell.html (menu button, `#scrCup`, one marked
  CSS block), build.py (UI_PARTS). Landscape: Quarter | Semi | Final + cup | Semi | Quarter with lines drawn by cupLines from the
  slots' offsets; upright phones get a stacked list (`#app.portrait`). New cup mode value `mode === "cup"`.
- ui/hud.js (after screens.js): the calmer match screen and danger readability, UI only (reads G, never writes it).
  Layout (shell.html, the HUD block): the timer `#clock` is a slim strip between the two cards (hung from the top edge above them on
  `#app.narrow`, upright phones, where the cards need the whole width and the hearts go under the percent); the pause icon `#pauseBtn`
  (same id, same tap) sits under the opponent's card inside `.hud-r`, 36px with a 46px touch target; the percent is the biggest text
  on a card (`.pc-pct`). The percent tint is `pctColor` (view.js): white to about 90%, yellow by 130%, red between 150% and
  `TUNE.finishPct` (175), from where the card pulses (`.pcard.finr`, the old finish cue made gentler: two reds, 0.9 s).
  Markers: `tagAlpha()` is read by `drawTag` (draw-world.js); `tagStep(g)` (called from `updateFx` once per sim tick) keeps them on during
  the countdown, 3 s after the match starts (TAG_HOLD 180 ticks), fades out in 0.5 s, and shows both again for 3 s after any respawn and at
  the start of sudden death; the tutorial keeps them on. Danger edge glow: `hudDanger()` (called each frame from loop.js, `hudIdle()`
  outside a match) walks the own fighter's launch forward (`launchReach`, the sim's knockback decay and hitstun gravity, stage ignored)
  and lights `#dgr` (four edge gradients, z-index 1 under the HUD and touch buttons) on the side(s) it heads for: 0 at the stage edge /
  a head height of -300, 1 at the blast line, glow from 0.45 to full at 0.95. Calibrated on 28,000 bot launches: every launch the sim
  called lethal ends at 1.15 or more, 99% of the non-KOs end below 1.02. Own fighter only, nothing in the KO finisher (FIN.on), nothing
  while paused, steady (no pulse) with reduced motion. `hudPauseZone()` keeps the off-screen bubble (effects.js drawBubbles) off the pause
  icon. Test hook: `window.__blastline.hud` = { tag, glow[4], reach[4], tick }.
- ui/finisher.js (between effects and screens): KO finisher cinematic, started by the final lethal hit (no
  finisher for a self-destruct or a failed recovery). Beat 0 is the real impact, then the staged scene ends
  with the loser launched out of the arena. Also the KO zoom on earlier lives (finLethal), the finishing-
  special band (finHit) and the FINISH! / charge feedback helpers. Pure UI: two stand-in fighters
  ("puppets", copies with state "fin" and a finPose hook that pose() calls), its own camera, particles and shapes on the effects layer, name card, skip, and it holds the results
  screen (finHold) until it ends. Timeline constants FT; one entry per fighter in FINS. FIN_NAME / finName():
  a finishing special with its own name (Gunslinger: "High Noon") on the band, the Finish! banner and the
  Special button; the others show their signature name.
- ui/manga.js (after finisher.js; the eight pages manga/<id>.js, one per fighter: alchemist dragon gunslinger odin
  phoenix reaper samurai wizard, spliced at its /*MANGA*/ marker, sorted): the KO finisher as a manga page.
  finStart plays MANGA[winner] before anything else: the real hit, the frozen frame inked (paper tint, dot tone,
  border, focus lines, sound word), panels sliding in over each other (the old ones stay visible), a face inset, the
  strike with a 120 ms drop and two impact frames, the loser tearing through the border along the real launch
  direction, the title block with the K.O. seal, results at 4720 ms, skip from 1000 ms. Timeline MT; a page is
  data + small functions (MANGA.<id>: panels(lay), words(lay), build, start, step, pose, impact, ...; dragon.js is
  the template). Puppets via mgPuppet, faces via P.expr in draw-fighters.js (terror grin rage calm dazed ko).
  The Cin sound kit lives here. Any throw falls back to the 2D finisher (FINS). Pure UI: never writes G.
  The frame-time watchdog PERF (effects.js) steps q up when matches run slow; the page reads it to pick its cheap
  tier. Tests pin it with window.__blastline.r3.lockQ = true (r3 is an old name; perf is the same object).
  The Reaper's page "Last Rites" (manga/reaper.js) is the one negative page: a bell tolls and the page turns near-black
  with white ink (drawn as usual, then turned over by a difference fill in its page(c, t) hook; the amber inside panels is
  drawn in its complement), candle amber only on his cheeks and the soul. A look panel (the loser's hatched shadow
  stretches up while the scythe rises behind the hood), a smirk inset, one white crescent stroke across
  the page (SHHK), the amber soul drifting up through the top border, a tombstone with R.I.P. and the loser's name, a
  whispered "shhh...". Engine hooks it added (each unset = the old behaviour): page(c, t) (a last pass over the page),
  hint(t) (skip-hint colour), mgPuppet o.mono (every colour grey), panel dim ("r,g,b" of the covered dimming).
  Video reaper-hub/manga/reaper-last-rites-manga-v1.mp4 + -sheet.jpg.
- ui/acct.js (after menus.js) + sync.js: the profile pill (top right of the start page, replaces the rating/chips card: avatar of
  `P.last`, name, tier badge in a progress ring + rating, chips, cups when `P.cups > 0`) and the Account sheet (`#scrAccount`, opened by
  tapping the pill: name, tier/rating/peak, wins/losses/chips/skins, recent results, the sync section, Reset progress, which moved
  here from Settings). `saveProfile()` (base.js) calls `acctDirty()`, so every change of a linked device is saved by itself ~1.2 s
  later; a pull runs when the page opens, comes back from the background or the sheet opens. No network during a match. sync.js is
  pure (code format `normCode`/`fmtCode`, `sanitize`, `mergeProf`, `applyTo`, `hasProgress`) and also a node module; build.py
  splices it at the SYNC marker in acct.js. A new profile field that should follow the player goes into sync.js (COUNTERS, or
  `sanitize` + `mergeProf` for other kinds) and `applyTo`. Device-only fields (sound, screen, fs, rules, a2hs) are never synced.
  The link to an account is stored on the device under `potatobrawl.acct.v1` (code, revision, base copy, last sync time, a pending
  reset), not in the profile. Test hooks: `window.__blAcct` (P, st, ui, sync, save).
- skinfx.js skin effects · shell.html markup + CSS · net-ws.js WebSocket
  shim (server build only) · mock-room.js two-tab test room · portraits/ (portraits.json is what's inlined).
- make-icons.py writes the home-screen icons into web/ (repo root) from portraits/phoenix.jpg.
- web/ (repo root): manifest.webmanifest + icons. server.js serves them from public/ if present; build.py and
  the deploy blocks copy them there.
- Fullscreen helpers (FS, goFull, leaveFull) live in ui/input.js next to touchUI; the Fullscreen setting is
  P.fs (undefined = on for touch devices); the iPhone tip is dismissed with P.a2hs.

## Accounts (sync codes): what is stored and where
- Server side is accounts.js (called from server.js), off unless `ACCOUNTS_DIR` names a writable folder; then `/api/acct/ping|new|load|save`
  (JSON POST, 16 KB body, per-IP 60 requests/min and 10 new accounts/hour, X-Forwarded-For only from 127.0.0.1, 20,000 accounts / 200 MB,
  unknown code = 404 after 350 ms). One file per account in that folder: `<sha256(code)>.json` = `{rev, t, prof}`, mode 600, written
  by temp file + rename. The code itself is never stored (it is 16 characters of Crockford base32, 80 bits, shown XXXX-XXXX-XXXX-XXXX).
  `prof` = rating, peak, streak, wins, losses, draws, matches, chips, friend wins/losses, cups, name, last fighter, owned skins, picked
  skins, tutorial done, last 50 results (+ per-fighter stats, flawless cups, picture, title). No email, no password, no IP is stored.
- Accounts hub (the Account sheet has three tabs: Profile, Stats, Locker). Profile: picture = any owned fighter + skin (`P.avatar` "id:skin",
  "" = fighter played last; the pill uses it too), title (`P.title`; "" = best earned; six titles in `ACT` in acct.js: tier = best tier reached
  after a first ranked match, Centurion 100 wins, Cup winner, Flawless = `P.flawless` counted in cup.js where the +30 is given, Collector,
  Wanderer = 7 fighters with ranked matches), shown under the name and on the pill when it fits. Stats: `P.fstats` {id:{w,l,d}} + `P.fsince`,
  counted in finishMatch only for ranked matches (the ones that already count in wins/losses/history, forfeits as losses); cup and friend matches
  are not counted. History keeps 50. Locker: every fighter and skin; owned ones equip via `equipSkin` (screens.js, shared with the select screen).
  Sync: new fields are optional in sync.js; a MISSING one (older page) is "unchanged", never zero (`OPT_COUNTERS`, fstats, avatar, title).
  Wanderer needs 7 although there are more fighters (the number is fixed on purpose, not the roster size).
- Live: deploy/accounts-setup.txt (Jonny pastes it once, after update.txt) makes /var/lib/potatobrawl/accounts, adds the systemd drop-in
  (ACCOUNTS_DIR, HOST=127.0.0.1, ReadWritePaths), installs the nightly backup (/var/backups/potatobrawl, 14 days) and closes port 8080.
  Until then the Account sheet says "Saving to an account isn't available yet." and nothing else changes.
- Two devices: the server keeps a revision; a stale save gets 409 with the newer copy and the page merges (counters add what each side
  changed since the last sync, skins are a union, everything else takes the side that changed it, the newer one if both did) and saves
  again. A reset on a linked device is a forced save that wins. Linking a device that has progress asks first and the account wins.

## Rules that keep online play working
- A core.js change that can change simulation results must stay deterministic, add new fighter fields to
  the newFighter defaults, FKEYS and checksum, reset them where needed (ko, startSudden), bump `PROTO` in
  game/ui/online.js (deploy/update.txt has no PROTO: it compares the page the game serves with GitHub's index.html).
- No service worker (a cached old build would desync matches).
- Balance band in check.sh is 44-57% (M3: phoenix 49.1, alchemist 45.8, odin 53.8, wizard 48.1, samurai 49.9,
  dragon 53.4; bots now charge sometimes and go for the special when the opponent is finish-ready).
  With the Gunslinger (night-gun, `bal7.js 80 0.5,0.8`): phoenix 50.4, alchemist 44.6, odin 52.7, wizard 50.7,
  samurai 51.5, dragon 51.0, gunslinger 49.1. The six old fighters play exactly as before (same bot matches
  frame by frame); their numbers moved only because adding a fighter shifts the seeds. Alchemist is close to
  the floor (about 44 against the other five alone, from the same table).
  With the Reaper and the Alchemist fix (2026-10-14, 80 games per pair at 0.5/0.8): phoenix 50.3, alchemist 48.6,
  odin 52.7, wizard 48.9, samurai 49.8, dragon 51.6, gunslinger 48.1, reaper 50.0.
  With the link (PROTO 7, same run): phoenix 52.3, alchemist 46.5, odin 52.1, wizard 49.2, samurai 51.9, dragon 47.9,
  gunslinger 49.3, reaper 50.8.

## Tests (tests/, run from anywhere)
snap.js (replay determinism) · bal7.js (balance; CORE=path compares another core; always the neutral bot) · botstyle.js (each CPU style
against the neutral bot, same fighter, levels 0.5/0.8: win rate 35-65% plus what the style does; STYLE='{"wizard":{"gap":2}}' tries
numbers, ONLY=wizard one fighter; check.sh step 4b) · lockrun.js (longest
unreactable jab run, check.sh wants <= 3 at R=14) · lockdet.js (save/restore while string launches happen) ·
finish.js (finish mode per fighter and weight, charge frame data, every lethal call in 30 bot matches ends
in that KO; check.sh step 3c) · pwfin.py (KO finisher per fighter from a real lethal hit; --2d, --up, --skip,
--self = self-destruct plays no finisher, --aim=left/up, WxH; steps requestAnimationFrame and
performance.now itself for screenshots) · pwfinish.py (FINISH! state, finishing special, KO zoom, charge
ring) · pwheavy.py (contact sheets of lights vs heavies) · pwmanga.py (the manga KO pages: --fighter --vs --at
WxH --up --aim --skip --reduced --sheet --throttle --video; prints the page's draw ms; also fails if three.js is requested or loaded) · lockhuman.js /
locktrace.js (light-attack lock vs human-speed defender) · lockcheck2/3.js (older) · rules7*.js (DI,
breakfall, sudden death) · topsim.js / topko.js (top-line deaths) · acct.js (accounts: server endpoints, limits, accounts off, and the merge; own server on port 8094; check.sh step 5b) · pwacct.py (accounts in the browser against a real server on port 8093: pill, sheet, two devices, conflict merge, reset, #sync= link, accounts off; screenshots of every sync state at 4 sizes; check.sh step 6b) · pwcup.py (the tournament: flow checks at 844x390, then a won cup and a lost quarter-final with
screenshots at 667x320, 844x390, 1280x760 and upright 390x844; tags flow s667 p844 d1280 up390) ·
pwhud.py (the match HUD: layout of the timer strip / pause icon / percent at 667x320, 844x390, 1280x760 and upright 390x844, marker fade and
return, percent tint, danger glow incl. reduced motion, none in the KO finisher, tutorial prompt vs the pause icon; check.sh step 6c; tags se phone desk up) ·
combos.js (every route lands on every fighter that has it at its trial damage, from one of a few spacings; Signature can't be
escaped at 0 and 30%; damage scaling; `node combos.js try k1,k2,...` tries a candidate route, `node combos.js <fighter> <route> <pct>
[1 jump | 2 dodge]` traces one run; check.sh step 3d, also in --quick) · pwcombo.py (route cards, the Combo trial driven by a script
through window.__blInput, misses + hint, Next/Exit, the all-13 reward paid once; tags flow s667 d1280 up390; check.sh 8b) ·
pwcomboreel.py (a half-speed video of trial routes on a frozen clock; needs ffmpeg) · pwdaily.py (Daily Potato with a Date stand-in:
one try, chips, streak, reload, next day, midnight; tags flow s667 p844 d1280 up390; check.sh 8c) ·
pwux2.py (all screens, 3 sizes) ·
pwsel.py · pwtut.py · pwline.py · pwmatch.py · pw2d.py · pwon.py (two-browser online match, needs
`PORT=8091 KEEPALIVE_MINUTES=0 node server.js`). Playwright scripts load build/test.html and write
screenshots into the current directory (check.sh uses build/shots/).
pwon.py now also asks both browsers for a rematch after the KO (prints "rematch ok").
finish.js, lockdet.js and snap.js pick their pairings from FIGHTERS.length (every pair, never a mirror match:
a mirror Dragon match found that lethal() drops projectiles in its look-ahead, so a later flame puff could
re-hit; see Next work). pwfin / pwfinish / pwheavy / pwmanga list all eight fighters.
experiments/lockfix-prototype/ was removed once the fix went into core.js (its checks are lockrun/lockdet).

## Deploy
- Live: Claude merges the pull request once all checks pass, then Jonny pastes deploy/update.txt on the server
  (the current file: since 2026-10-14 it compares the page the game serves on 127.0.0.1:8080 with index.html
  from GitHub instead of grepping a PROTO number, so it never needs editing; an older saved copy that greps
  "const PROTO = N" prints "still the old version" after a bump even when the update went live). It must print
  "new version is live: <commit> <subject>". No more file uploads. Since M1 the block also copies web/* (manifest, icons).
- Beta (once set up): deploy/beta-update.txt with BRANCH set to the branch to try.

## Gotchas
- `pkill -f <pattern>` kills the tool's own shell. Kill node by pid:
  `for p in $(ps -eo pid,comm,args | awk '$2=="node" && /server.js/ {print $1}'); do kill $p; done`
- server.js caches files at start: restart it after a rebuild.
- Google Fonts are blocked in the sandbox; screenshots use fallback fonts.
- Jonny's preferences: raw findings, correctness over speed, no silent code changes, flag assumptions,
  stop and ask instead of guessing, plan before code changes, session conclusion + next plan at the end.

## Next work, in order
- NEXT: session 2 of the big-features plan, Ultimates (Jonny's order, 2026-10-14 11:55 UTC, each session in a fresh thread): the
  bar under the name card, the button, the freeze, all eight ultis, CPUs that use them, balance, the first two or three Ultimate
  KO pages; one reload (PROTO 8). Also the tutorial gets a Dodge step (it never had one; Jonny noticed on PC) and an
  Ulti step, both in this session. Online encIn is full: the ULTI button needs a third input character or a reuse (decide first).
  Then 3. the rest of the Ultimate KO pages + fighter mastery; 4. boss engine + the Devil + The Field + the Road's first 8 stops;
  5. Alien + Sea Monster, their stages, Road skins; 6. online 2v1; 7. 2v2 (offline, then online).
- Combos/Daily leftovers: the Daily's Brutal (0.87) is still below Practice Hard (0.9); changing the device clock gives an extra
  Daily try (accepted, offline game); a player who clears all 13 routes on two devices before they sync is paid twice.
- The big-features plan (Jonny, 2026-10-14), approved with its default decisions:
  https://claude.ai/code/artifact/52412947-3a3c-4d13-80ae-8e441903fd1b (Fable's design: /mnt/project-files/next-ideas/fable-ideas.md).
  Default order: 1. combos ("the link": an ender within 12 frames of the 2nd light starts 6 frames faster, +8 hitstun; named
  routes; a Combo trial in How to play) + Daily Potato; 2. ultimates (bar under the name card, ULTI button when full, max 2, a
  freeze, a 6th input button: online encIn is full at 2 base64 chars); 3. Ultimate KO pages + fighter mastery; 4. 3+ fighters on
  stage + boss engine (HP + poise/stagger, brain in core.js on g.rng) + the Devil + "The Road" story map; 5. Alien + Sea Monster;
  6. online 2v1; 7. 2v2 (offline first, online last). Code check: rooms already allow 64 players (no server change); the
  two-fighter assumptions are spawns, respawn, ko() winner, checkLethal final, endByTime, serialize hitLog [0,1], HUD #pc0/#pc1,
  finisher puppets, online.js's single opponent.
- Small leftovers from the Reaper session: the shared charge-glow centre draws black for every fighter except the Reaper (mix()
  returns rgb() that glowDot reads as black; worked around for the Reaper only); the Reaper's select preview is drawn smaller;
  the upright "Practice · no rating" heading wraps at 390x844; finishing-special KOs label the manga card with the signature name
  (Reaper and Gunslinger pages set their own text); pwhud's KO-finisher setup can time out under load (the CPU never lands the hit).
- Tournament (night of 2026-10-13): offline against 7 CPUs is in. Next: online (the host runs the bracket, friends join by link, CPUs
  fill empty seats, each pair plays on a room code; after accounts), a cup counter on the profile pill (P.cups is written), the Dragon's
  edge-guard style could get an aerial chase, an "all fighters" cup variant.
On 2026-10-13, after playing M1 + M2, Jonny asked for special finishes, Mortal-Kombat-style finishers, heavies
that differ from lights, a charged heavy, and the finisher starting on the KO hit. He chose to do this before
accounts (1 s charge).
- M3 fight feel: live; Jonny's phone test (sounds) still pending.
- M4 now: 2D manga KO finishers for all six (this PR). Next: Jonny's notes on the videos, a real-phone check of the
  page's draw time (budget 6 ms/frame). The 3D code is removed (night clean-up). three.min.js is gone from the repo root,
  build.py, server.js and the deploy lines (now `cp -f index.html web/* public/`).
- M4 history (finisher-films/plan.md): 1. 2D only + red hearts (display only). 2. The 3D film engine + the
  Dragon's "Inferno" film, sent to Jonny as a video before the rest. 3. The other five films (Phoenix, then
  Wizard + Alchemist, then Odin + Samurai). UI only, no PROTO bump. The Potatalities move to a later finisher
  shop that sells alternates for chips (the existing currency) next to the skins.
- Gunslinger follow-ups: Jonny's notes on the video and on his manga page (High Noon). lethal() empties the projectile list in its look-ahead (h.projs = []), so a projectile still in the
  air (Dragon's flame puffs, a bullet in flight) is not part of the KO call; harmless so far
  (finish.js passes) but a mirror Dragon match once called a KO that a later puff then changed.
- M5: accounts via sync code: built (night-acct, see "Accounts" above). Live once Jonny has merged it, pasted update.txt and then
  accounts-setup.txt. Not done: a way to recover a lost code (by design there is none), several accounts per device, syncing the settings.
- Then hit-feel polish, finisher Phase 3 (bloom on strong phones, music stingers), upgraded finishers for top
  skins.
- Then the backlog, ordered by Jonny's answers (plan doc, decision 8) and the Project's FEEDBACK doc.
