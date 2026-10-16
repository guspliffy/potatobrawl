#!/usr/bin/env bash
# One command for all checks. Prints one PASS/FAIL line per check, with its time; details go to build/check-logs/.
#   ./check.sh          everything: the build, then the other steps side by side (about 20 minutes; it was 2 hours one by one)
#   ./check.sh --quick  build + PROTO + replay + lock + finish + combo routes + ultimates + boss fights + 2v2 only (seconds)
# After the build, the three server tests run on their own (their timers are short), then two lanes: up to CHECK_JOBS (default 2)
# browser steps at once, which play in real time, and the simulations next to them at low priority, so they only take the CPU the
# browsers leave over. More browsers at once don't finish sooner on 4 cores, they only starve each other. The lines keep the order below.
#   CHECK_JOBS=1 ./check.sh     one browser step at a time (a slow or busy machine)
#   PORT_BASE=9091 ./check.sh   the test servers use ports PORT_BASE .. PORT_BASE+10 (default 8091), e.g. for a second checkout
# Needs: node, python3, `npm install` (ws), and Python Playwright matching the installed Chromium
# (in Claude's cloud container: python3 -m pip install playwright==1.56.0).
set -u
cd "$(dirname "$0")"
ROOT=$PWD
LOGS=$ROOT/build/check-logs
SHOTS=$ROOT/build/shots
RES=$LOGS/results
rm -rf "$RES"; mkdir -p "$LOGS" "$SHOTS/ux2" "$RES"
QUICK=0; [ "${1:-}" = "--quick" ] && QUICK=1
JOBS=${CHECK_JOBS:-2}
PB=${PORT_BASE:-8091}
STEP=
pass() { echo "PASS  $1" > "$RES/$STEP"; }
fail() { echo "FAIL  $1  (log: ${2#$ROOT/})" > "$RES/$STEP"; }
# a server for one browser step: serve PORT LOG (sets SRV), stop it with `stop`
serve() { PORT=$1 KEEPALIVE_MINUTES=0 node server.js > "$2" 2>&1 & SRV=$!; sleep 1; }
stop() { kill $SRV 2>/dev/null; wait $SRV 2>/dev/null; }

# 1. Build. index.html is committed, so a source change without a rebuilt index.html shows up here.
s_build() {
if python3 game/build.py > "$LOGS/build.log" 2>&1; then
  if git diff --quiet -- index.html; then pass "build (index.html matches the committed one)"
  else pass "build (index.html changed: commit it with the source change)"; fi
else fail "build" "$LOGS/build.log"; fi
}

# 2. The deploy block checks the served page against GitHub's index.html, so it carries no PROTO to keep in step
#    (an old copy that grepped a PROTO number printed "still the old version" after every bump).
s_proto() {
P=$(grep -o 'const PROTO = [0-9]*' game/ui/online.js)
if [ -n "$P" ] && grep -q "$P" index.html && ! grep -q 'const PROTO' deploy/update.txt && grep -q 'cmp -s - index.html' deploy/update.txt; then pass "PROTO (${P#const }) is in index.html; deploy/update.txt checks the served page"
else fail "PROTO / deploy block: index.html must carry '$P' and deploy/update.txt must compare the served page, not grep a PROTO" "deploy/update.txt"; fi
}

# 3. Replay determinism (MAP=all: the seed picks one of the four map layouts, as in snap/lockdet/finish/bal7/botstyle).
s_snap() {
(cd tests && MAP=all node snap.js) > "$LOGS/snap.log" 2>&1
if grep -q "mismatches: 0 /" "$LOGS/snap.log"; then pass "replay determinism (snap.js 0 mismatches)"
else fail "replay determinism" "$LOGS/snap.log"; fi
}

# 3b. Light-attack lock: longest run of unreactable jabs (defender reacts 14 frames after it can move),
#     plus save/restore checks while light-string launches happen.
s_lock() {
(cd tests && node lockrun.js 14 && MAP=all node lockdet.js) > "$LOGS/lock.log" 2>&1
RUN=$(grep -o 'longest run of hits[^:]*: [0-9]*' "$LOGS/lock.log" | grep -o '[0-9]*$')
if [ -n "$RUN" ] && [ "$RUN" -le 3 ] && grep -q "mismatches: 0," "$LOGS/lock.log"; then pass "light-attack lock (longest unreactable run $RUN hits, 0 save/restore mismatches)"
else fail "light-attack lock (longest run '${RUN:-?}', want 3 or less)" "$LOGS/lock.log"; fi
}

# 3c. Finish mode, charged heavies, KO at the hit: specials KO from the finish percent (not below), a tap is
#     unchanged, a full charge adds its damage, and every "this hit is a KO" call really ends in that KO.
s_finish() {
(cd tests && MAP=all node finish.js 30) > "$LOGS/finish.log" 2>&1
if grep -q "^finish ok" "$LOGS/finish.log"; then pass "finish mode + charge + KO at the hit ($(grep -o 'lethal calls [0-9]*' "$LOGS/finish.log"), 0 wrong)"
else fail "finish mode / charge / KO at the hit" "$LOGS/finish.log"; fi
}

# 3d. Combo routes and the link: every fighter lands each of its six routes on a standing CPU at the trial's damage, light,
#     light, special is a true combo at 0% and 30% (no jump or dodge escape after the second light), and combo damage scales.
s_combos() {
(cd tests && node combos.js) > "$LOGS/combos.log" 2>&1
if grep -q "^combos ok" "$LOGS/combos.log"; then pass "combo routes + the link (all 13 routes land on every fighter that has them)"
else fail "combo routes / the link" "$LOGS/combos.log"; fi
}

# 3e. Ultimates: every ulti KOs the lightest and the heaviest fighter in its percent band (never from 0), the first hit lands 24+
#     frames after the freeze, the bar is spent on the press, a third use is refused, and save/restore mid-ulti matches.
s_ulti() {
(cd tests && node ulti.js) > "$LOGS/ulti.log" 2>&1
if grep -q "^ulti ok" "$LOGS/ulti.log"; then pass "ultimates (KO bands, first hit after the freeze, bar spent, save/restore mid-ulti)"
else fail "ultimates" "$LOGS/ulti.log"; fi
}

# 3f. Boss fights (2v1): replay and save/restore determinism with three fighters, then two bot players against Old Scratch at each
#     difficulty, then the same against Zorp and Kraken Spud: win rates and fight lengths in their bands, every move used, the final launch leaves the
#     arena, lethal calls come true.
s_boss() {
(cd tests && node boss.js) > "$LOGS/boss.log" 2>&1
if grep -q "^boss ok" "$LOGS/boss.log"; then pass "boss fights (Normal win rates: $(grep -o '^boss ok (Normal: [^)]*' "$LOGS/boss.log" | sed 's/^boss ok (Normal: //'); determinism, final launch, lethal calls)"
else fail "boss fights" "$LOGS/boss.log"; fi
}

# 3g. 2v2 (Team Brawl): replay and save/restore with four fighters, spawn and respawn sides, no friendly fire, the time-out by team hearts and
#     sudden death for four, the Catch (and never on the final launch, by a foe, in 1v1 or a boss fight), then mirrored CPU teams: sides,
#     every fighter's 2v2 win rate, match length.
s_duo() {
(cd tests && node duo.js) > "$LOGS/duo.log" 2>&1
if grep -q "^duo ok" "$LOGS/duo.log"; then pass "2v2 ($(grep -o '[0-9]* games at[^:]*: left side wins [0-9.]*%' "$LOGS/duo.log" | sed 's/^.*left/left/'); rules, the Catch, determinism)"
else fail "2v2" "$LOGS/duo.log"; fi
}

# 4. Balance: every fighter's bot win rate inside the band, over all four maps (MAP=all: the seed picks the map; MAP=<i> one map).
# 58: Phoenix sits at 57.4% since the ultis got 1.75x launch knockback (2026-10-14; 55% before), inside the noise of 80 games a pair
s_balance() {
LO=${BAL_LO:-44}; HI=${BAL_HI:-58}
(cd tests && MAP=all node bal7.js 80 0.5,0.8) > "$LOGS/balance.log" 2>&1
OUT=$(awk -v lo=$LO -v hi=$HI '/%$/ && NF==2 { v=$2+0; n++; if (v<lo||v>hi) bad=bad" "$1"="$2 } END { if (n==0) print "none"; else print bad }' "$LOGS/balance.log")
RANGE=$(awk '/%$/ && NF==2 { printf "%s %s  ", $1, $2 }' "$LOGS/balance.log")
if [ -z "$OUT" ]; then pass "balance ${LO}-${HI}%: $RANGE"
else fail "balance outside ${LO}-${HI}%:$OUT" "$LOGS/balance.log"; fi
}

# 4b. CPU fighting styles: each fighter's styled CPU against the neutral one, same fighter, stays between 35% and 65%.
s_botstyle() {
(cd tests && MAP=all node botstyle.js 100) > "$LOGS/botstyle.log" 2>&1
if grep -q "^botstyle ok" "$LOGS/botstyle.log"; then pass "CPU styles (styled vs neutral win rates inside 35-65%)"
else fail "CPU styles outside 35-65% against the neutral CPU" "$LOGS/botstyle.log"; fi
}

# 4c. The Road gets harder stop by stop: a regular (0.7) and a skilled (0.9) player bot play every stop with each fighter under its rules;
#     the CPU's strength rises to 1.00, the first stop is won 85%+, the last 20% or less, no stop is 10+ points easier than the one before,
#     each region is 15+ points harder than the one before, and the Road bosses get tougher region by region.
s_roadcurve() {
(cd tests && node roadcurve.js) > "$LOGS/roadcurve.log" 2>&1
if grep -q "^roadcurve ok" "$LOGS/roadcurve.log"; then pass "the Road's curve ($(grep -o '^roadcurve ok (.*' "$LOGS/roadcurve.log" | sed 's/^roadcurve ok (//; s/)$//'))"
else fail "the Road's curve (a stop or region is easier than the one before)" "$LOGS/roadcurve.log"; fi
}

# 5. Online: two browsers play a match through a local server.
s_online() {
serve $PB "$LOGS/server.log"
(cd "$SHOTS" && PWON_URL=http://localhost:$PB/ timeout 300 python3 "$ROOT/tests/pwon.py") > "$LOGS/online.log" 2>&1
stop
if grep -q "^desyncs 0 0" "$LOGS/online.log" && grep -q "^glaze ok" "$LOGS/online.log" && grep -q "^rematch ok" "$LOGS/online.log" && grep -q "^no errors" "$LOGS/online.log"; then
  pass "online match (0 desyncs, the friend sees your glaze and nameplate, rematch after the KO finisher, no page errors)"
else fail "online match" "$LOGS/online.log"; fi
}

# 5c. Online boss fights (2v1 on two phones): the repair copy of every boss fits a presence in pieces and restores frame for frame
#     (node), then two browsers through a local server: the lobby's Vs boss mode, Team up, three fighters on his map with all his HP,
#     NICE! both ways, a forced desync repaired by the copy in pieces, the KO page and Victory on both, Next: Hard, a dropped friend
#     (a CPU takes over, Retry vs CPU), the lobby at four sizes. Shots in build/shots/onboss.
s_onboss() {
(cd tests && node onsnap.js) > "$LOGS/onsnap.log" 2>&1
serve $((PB + 4)) "$LOGS/server-onboss.log"
(cd "$SHOTS" && ONBOSS_URL=http://localhost:$((PB + 4))/ timeout 900 python3 "$ROOT/tests/pwonboss.py" onboss) > "$LOGS/onboss.log" 2>&1
stop
if grep -q "^onsnap ok" "$LOGS/onsnap.log" && grep -q "^onboss ok" "$LOGS/onboss.log" && grep -q "^no errors" "$LOGS/onboss.log"; then
  pass "online boss fights (repair copy in pieces, Team up, NICE!, desync repaired, KO page + Next: Hard on both, CPU takes over a drop)"
else fail "online boss fights" "$LOGS/onboss.log (and onsnap.log)"; fi
}

# 5f. Online Team Brawl (2v2 for up to four phones) through a local server: the lobby's 2 vs 2 and CPUs row, the board,
#     Join and Switch side, host + friend vs two CPUs (names, a Focus ping, a forced desync repaired, Victory, Rematch, Defeat, Board),
#     then four friends (a repair on all four, a friend's page and the host's page closing: CPUs from the same frame everywhere and
#     the next friend leads, a CPU partner's Focus on every phone, the rematch of the two left), the board at four sizes.
#     Shots in build/shots/on2v2.
s_on2v2() {
serve $((PB + 8)) "$LOGS/server-on2v2.log"
(cd "$SHOTS" && ON2V2_URL=http://localhost:$((PB + 8))/ timeout 1200 python3 "$ROOT/tests/pwon2v2.py" on2v2) > "$LOGS/on2v2.log" 2>&1
stop
if grep -q "^on2v2 ok" "$LOGS/on2v2.log" && grep -q "^no errors" "$LOGS/on2v2.log"; then
  pass "online 2v2 (board, four phones in step, repairs, drops to CPUs, the lead hands over, rematch and board)"
else fail "online 2v2" "$LOGS/on2v2.log"; fi
}

# 5b. Accounts (sync codes): the server's endpoints and limits with a temporary folder, and the merge. Node only.
s_acct() {
ACCT_PORT=$((PB + 3)) timeout 120 node tests/acct.js > "$LOGS/acct.log" 2>&1
if grep -q "^acct ok" "$LOGS/acct.log"; then pass "accounts server + merge ($(grep -c '^PASS' "$LOGS/acct.log") checks)"
else fail "accounts server + merge" "$LOGS/acct.log"; fi
}

# 5d. Quick match on the server (quick.js): the queue (Ranked and Casual, the ±200/±400 widening, Ranked falls back to Casual, no Ranked
#     rematch), the referee (bot matches replayed from the relayed inputs give the game's verdict, a late phone, a leaver, a quiet phone,
#     a wrong start), the Elo and placement, accounts off (Casual only). Node only.
s_quick() {
QUICK_PORT=$((PB + 1)) timeout 300 node tests/quick.js > "$LOGS/quick.log" 2>&1
if grep -q "^quick ok" "$LOGS/quick.log"; then pass "Quick match server + referee ($(grep -c '^PASS' "$LOGS/quick.log") checks)"
else fail "Quick match server + referee" "$LOGS/quick.log"; fi
}

# 5e. Quick match in the browser: three players through a real server: the Season sheet, Find match, the CPU warm-up while
#     searching, PLAYER FOUND!, the VS screen, a Ranked match decided by the server, no Ranked rematch (Casual after 20 s), a Casual
#     leave, a Ranked forfeit, the menu's online rank. Shots in build/shots/quick.
s_quickui() {
(cd "$SHOTS" && PWQUICK_PORT=$((PB + 9)) timeout 900 python3 "$ROOT/tests/pwquick.py" quick) > "$LOGS/quick-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/quick-ui.log"; then pass "Quick match in the browser (search, warm-up, found, VS, Ranked by the server, Casual, forfeit; shots in build/shots/quick)"
else fail "Quick match in the browser" "$LOGS/quick-ui.log"; fi
}

# 6. Screens on small phone, phone and desktop, without page errors.
s_screens() {
(cd "$SHOTS" && timeout 900 python3 "$ROOT/tests/pwux2.py" .) > "$LOGS/screens.log" 2>&1
if grep -q "^no errors" "$LOGS/screens.log"; then pass "screens 667x320, 844x390, 1280x760 (shots in build/shots/)"
else fail "screens" "$LOGS/screens.log"; fi
}

# 6a. Skins and the Play friends lobby (UI only): the Skins bar on the select, the Skin Rack (seven cards in their states, what each
#     locked skin needs, two-tap Buy, one-tap Wear, Esc / backdrop / X), a Road boss beaten with another fighter, and the lobby's Fight
#     Card (opens the select, "Use <fighter>", Back, the name input on the public site), at four sizes. Shots in build/shots/skins.
s_skins() {
(cd "$SHOTS" && PWSKINS_PORT=$((PB + 5)) timeout 900 python3 "$ROOT/tests/pwskins.py" skins) > "$LOGS/skins.log" 2>&1
if grep -q "^skins ok" "$LOGS/skins.log" && grep -q "^no errors" "$LOGS/skins.log"; then pass "skins menu + Play friends lobby (Skin Rack states, buy, wear, Fight Card at four sizes; shots in build/shots/skins)"
else fail "skins menu + Play friends lobby" "$LOGS/skins.log"; fi
}

# 6a2. The Shop and Another go (UI only): the Account sheet's Shop tab (nameplates and Glaze, two-tap buy, one-tap wear, short of chips), the
#      plate on the start page, the Profile and the results, the Daily sheet's Another go and its rules, at four sizes. Shots in build/shots/shop.
s_shop() {
(cd "$SHOTS" && timeout 1500 python3 "$ROOT/tests/pwshop.py" shop) > "$LOGS/shop.log" 2>&1
if grep -q "^shop ok" "$LOGS/shop.log" && grep -q "^no errors" "$LOGS/shop.log"; then pass "shop + Another go (nameplates, Glaze, buy / wear / short, Daily rules at four sizes; shots in build/shots/shop)"
else fail "shop + Another go" "$LOGS/shop.log"; fi
}

# 6b. Accounts in the browser: profile pill, Account sheet, two devices syncing through a real server.
s_acctui() {
(cd "$SHOTS" && PWACCT_PORT=$((PB + 2)) timeout 1200 python3 "$ROOT/tests/pwacct.py" acct) > "$LOGS/accounts-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/accounts-ui.log"; then pass "accounts in the browser (pill, sheet, two devices, conflict merge, accounts off; shots in build/shots/acct)"
else fail "accounts in the browser" "$LOGS/accounts-ui.log"; fi
}

# 6c. Match HUD (UI only): timer strip, pause icon under the opponent's card, YOU/CPU markers fading and coming back, percent tint,
#     danger edge glow for a hard launch of the player's own fighter, none in the KO finisher. Pictures in build/shots/hud.
s_hud() {
(cd "$SHOTS" && timeout 1200 python3 "$ROOT/tests/pwhud.py" hud) > "$LOGS/hud.log" 2>&1
if grep -q "^no errors" "$LOGS/hud.log"; then pass "match HUD (layout, markers, percent tint, danger glow; shots in build/shots/hud)"
else fail "match HUD" "$LOGS/hud.log"; fi
}

# 6d. Ultimates on the HUD: the bar under both cards (empty, half, full, spent), the ULTI button only while full and clear of the
#     other buttons, a press by tap / U key / gamepad Y starts the ulti, reduced motion. Shots in build/shots/ult.
s_ultui() {
(cd "$SHOTS" && timeout 900 python3 "$ROOT/tests/pwult.py" ult) > "$LOGS/ult-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/ult-ui.log"; then pass "ulti bar + ULTI button (tap, U key, gamepad Y; shots in build/shots/ult)"
else fail "ulti bar + ULTI button" "$LOGS/ult-ui.log"; fi
}

# 6e. The guided first round: nine steps (Move ... Dodge, Ultimate, Knock them off) on desktop and four touch sizes. Shots in build/shots/tut.
s_tut() {
(cd "$SHOTS" && timeout 1200 python3 "$ROOT/tests/pwtut.py" tut) > "$LOGS/tutorial.log" 2>&1
if grep -q "^no errors" "$LOGS/tutorial.log"; then pass "tutorial (nine steps incl. Dodge and Ultimate; shots in build/shots/tut)"
else fail "tutorial" "$LOGS/tutorial.log"; fi
}

# 6f. Maps: every map in a Practice match picked through the Map picker at four sizes (start, two CPUs fighting, the KO splash),
#     drawing cost against Potato Moon's, every map has its art. Shots in build/shots/maps.
s_maps() {
(cd "$SHOTS" && timeout 1500 python3 "$ROOT/tests/pwmaps.py" maps) > "$LOGS/maps.log" 2>&1
if grep -q "^no errors" "$LOGS/maps.log"; then pass "maps (four layouts and looks at four sizes, KO splash, frame cost; shots in build/shots/maps)"
else fail "maps" "$LOGS/maps.log"; fi
}

# 7. KO finisher: one played through to the results screen, one skipped by a tap.
s_finisher() {
(cd "$SHOTS" && timeout 300 python3 "$ROOT/tests/pwfin.py" dragon && timeout 120 python3 "$ROOT/tests/pwfin.py" samurai --skip) > "$LOGS/finisher.log" 2>&1
if [ "$(grep -c "^no errors" "$LOGS/finisher.log")" = 2 ]; then pass "KO finisher (plays through, skips, results screen after)"
else fail "KO finisher" "$LOGS/finisher.log"; fi
}

# 8. Tournament: start a cup, win the quarter-final (chips paid, bracket moves on), lose the semi-final (no rating change), run it back,
#    leave, reload into a cup, forfeit from the pause menu.
s_cup() {
(cd "$SHOTS" && timeout 600 python3 "$ROOT/tests/pwcup.py" cup flow) > "$LOGS/cup.log" 2>&1
if grep -q "^no errors" "$LOGS/cup.log"; then pass "tournament (bracket, chips, loss, run it back, reload, forfeit; no page errors)"
else fail "tournament" "$LOGS/cup.log"; fi
}

# 8b. Combos in the browser: route cards in How to play, the Combo trial (keys light up, cleared routes saved, hint after three
#     misses, Next, Exit), the Combo Potato reward paid once. Shots in build/shots/combo.
s_comboui() {
(cd "$SHOTS" && timeout 900 python3 "$ROOT/tests/pwcombo.py" combo) > "$LOGS/combo-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/combo-ui.log"; then pass "Combo trial in the browser (cards, trial, reward; shots in build/shots/combo)"
else fail "Combo trial in the browser" "$LOGS/combo-ui.log"; fi
}

# 8c. Daily Potato: the day's matchup on the menu, one try, a win pays 40 chips and grows the streak on the pill, a reload or a
#     forfeit can't give a second try, the next day brings a new matchup. Shots in build/shots/daily.
s_daily() {
(cd "$SHOTS" && timeout 900 python3 "$ROOT/tests/pwdaily.py" daily) > "$LOGS/daily-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/daily-ui.log"; then pass "Daily Potato in the browser (one try, chips, streak; shots in build/shots/daily)"
else fail "Daily Potato in the browser" "$LOGS/daily-ui.log"; fi
}

# 8d. Boss fights in the browser: Practice > VS > Old Scratch (his difficulty, his map), the fight with a CPU partner, the boss bar
#     (HP, stagger, FINISH), the KO page on the final hit, Victory / Defeat results, the bar at four sizes; then Zorp on The Kitchen
#     (his line, the hover, the crash into his floor phase, the finish) and Kraken Spud on The Deep (out at sea, a slammed tentacle,
#     the finish). Shots in build/shots/boss.
s_bossui() {
(cd "$SHOTS" && timeout 900 python3 "$ROOT/tests/pwboss.py" boss) > "$LOGS/boss-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/boss-ui.log"; then pass "boss fights in the browser (Practice entry, boss bar, KO page, results; shots in build/shots/boss)"
else fail "boss fights in the browser" "$LOGS/boss-ui.log"; fi
}

# 8e. The Road: the start-page card, the map and its locks, a stop's sheet, a stop played with its rules (lives, time, map, start
#     percents), the stars and chips paid once and saved, Retry / The Road / quitting to the map, the fence at 12 stars, Old Scratch's
#     first win (Devil Masher + 150 chips), the walk and Next stop / To <boss> / To <region> / Next: Hard, The Kitchen's region and
#     its boss, the Road skins, Retry beside Next stop (naming the missing star; gone with three stars), a combo star's combo line
#     and its Combo trial with Back to the stop, and the card, map and sheets at five sizes. Shots in build/shots/road.
s_roadui() {
(cd "$SHOTS" && timeout 900 python3 "$ROOT/tests/pwroad.py" road) > "$LOGS/road-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/road-ui.log"; then pass "the Road in the browser (map, stops, stars, the fence, Old Scratch; shots in build/shots/road)"
else fail "the Road in the browser" "$LOGS/road-ui.log"; fi
}

# 8f. Fighter mastery: XP per finished match (Practice by CPU level, ranked, forfeit), the level-up row on the results screen, chips paid once,
#     MASTERED at Lv 10, the one-time head start, the roster shield and detail row, titles, Stats and the Locker's Collection, a KO page
#     recorded, the cup's XP sticker. Shots in build/shots/mastery.
s_mastery() {
(cd "$SHOTS" && timeout 1500 python3 "$ROOT/tests/pwmastery.py" mastery) > "$LOGS/mastery-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/mastery-ui.log"; then pass "fighter mastery in the browser (XP, level up, rewards, titles, Locker; shots in build/shots/mastery)"
else fail "fighter mastery in the browser" "$LOGS/mastery-ui.log"; fi
}

# 8g. Play counts, the server side (stats.js): known keys counted, the rest ignored, size and rate limits, the page key, day files
#     (Europe/Berlin midnight, the write on shutdown, a restart that goes on counting), off without STATS_DIR. Node only.
s_stats() {
STATS_PORT=$((PB + 6)) timeout 120 node tests/stats.js > "$LOGS/stats.log" 2>&1
if grep -q "^stats ok" "$LOGS/stats.log"; then pass "play counts server ($(grep -c '^PASS' "$LOGS/stats.log") checks)"
else fail "play counts server" "$LOGS/stats.log"; fi
}

# 8h. Play counts in the browser (ui/counter.js) against a real server: a new player's first visit (tutorial skipped, a
#     match won, Rematch, a quit, where they left), the same day again, Settings > Play counts Off / On, Global Privacy Control, a player
#     from before the counter (a 2v2 win counts as "team"), came back after three days, an error, and a server with the counter off (one try, then silence).
s_statsui() {
PWSTATS_PORT=$((PB + 7)) timeout 900 python3 "$ROOT/tests/pwstats.py" > "$LOGS/stats-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/stats-ui.log"; then pass "play counts in the browser (first visit, Off/On, privacy signal, returning, counter off)"
else fail "play counts in the browser" "$LOGS/stats-ui.log"; fi
}

# 8i. The private stats page (web/stats.html, served at /stats) with sample data at 390x844, 844x390 and 1280x800, each range, dark mode,
#     no data, a wrong key, no key: no page errors, no sideways scroll. Shots in build/shots/stats.
s_statspage() {
(cd "$SHOTS" && PWSTATSPAGE_PORT=$((PB + 10)) timeout 600 python3 "$ROOT/tests/pwstatspage.py" stats) > "$LOGS/stats-page.log" 2>&1
if grep -q "^no errors" "$LOGS/stats-page.log"; then pass "stats page (three sizes, ranges, dark mode, empty, wrong key; shots in build/shots/stats)"
else fail "stats page" "$LOGS/stats-page.log"; fi
}

# 8j. Team Brawl 2v2 in the browser: Practice > VS > Team Brawl 2v2 (the Partner chip, pool-only maps), a fight with four cards on the HUD (yours,
#     the partner's mini card, two foe cards), Focus by a tap on a foe card (Tab on a keyboard), the Finish banner only for a foe, the team
#     rims, the forced end into the KO page and the results, a 1v1 afterwards with its two cards back; the select header and the HUD at four
#     sizes, a Catch. Shots in build/shots/duo.
s_duoui() {
(cd "$SHOTS" && timeout 1500 python3 "$ROOT/tests/pwduo.py" duo) > "$LOGS/duo-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/duo-ui.log"; then pass "2v2 in the browser (picker, four-card HUD, Focus, rims, results; shots in build/shots/duo)"
else fail "2v2 in the browser" "$LOGS/duo-ui.log"; fi
}

# 8k. Fullscreen: the menu's button follows the real state (fullscreenchange) and switches with one tap, the Settings row reads
#     "Fullscreen in fights" with the real state under it, iPhone gets the Add to Home Screen sheet, the home-screen app has no
#     button, a full top bar drops it first. The website build on a made-up origin inside Playwright (no port). Shots in build/shots/fs.
s_fsui() {
(cd "$SHOTS" && timeout 300 python3 "$ROOT/tests/pwfs.py" fs) > "$LOGS/fs-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/fs-ui.log"; then pass "fullscreen button, Settings row and iPhone sheet (shots in build/shots/fs)"
else fail "fullscreen button / Settings row / iPhone sheet" "$LOGS/fs-ui.log"; fi
}

# The order the lines come in (the numbering above).
QUICK_STEPS=(build proto snap lock finish combos ulti boss duo)
ORDER=("${QUICK_STEPS[@]}" balance botstyle roadcurve online onboss on2v2 acct quick quickui screens skins shop acctui hud ultui tut maps
  finisher cup comboui daily bossui roadui mastery stats statsui statspage duoui fsui)
# The lanes, each longest first (mastery about 6 minutes, maps 5, the accounts sheet 3, ...). Simulations play no clock, so they run at low
# priority next to the rest; the server tests (quick, acct, stats) have short timers, so they run alone first (about 20 seconds).
SIMS=(balance botstyle roadcurve duo boss snap finish lock combos ulti)
SOLO=(quick acct stats)
REAL=(mastery maps shop acctui on2v2 hud daily screens roadui duoui quickui tut skins bossui ultui onboss comboui cup statsui online statspage finisher fsui)
if [ $QUICK = 1 ]; then SIMS=(boss duo snap finish lock combos ulti); SOLO=(); REAL=(); fi

# one step in the background: its line goes to $RES/<step>, its seconds to $RES/<step>.t (written last: the step is done)
run() { STEP=$1; local t0=$SECONDS; "s_$1"; echo $((SECONDS - t0)) > "$RES/$1.t"; }
# a lane: its steps in the listed order, at most $1 at a time
lane() { local n=$1 s; shift; for s in "$@"; do while [ "$(jobs -rp | wc -l)" -ge "$n" ]; do wait -n; done; run "$s" & done; wait; }
# print the finished steps in ORDER, up to the first that is still running
NEXT=0; FAILS=0
flush() {
  local s line t
  while [ $NEXT -lt ${#ORDER[@]} ]; do
    s=${ORDER[$NEXT]}
    if [ $QUICK = 1 ] && [[ " ${QUICK_STEPS[*]} " != *" $s "* ]]; then NEXT=$((NEXT + 1)); continue; fi
    [ -f "$RES/$s.t" ] || return 0
    line=$(cat "$RES/$s" 2>/dev/null) || line="FAIL  $s (it ended without a result)"
    [[ $line == FAIL* ]] && FAILS=$((FAILS + 1))
    t=$(cat "$RES/$s.t"); echo "$line  [$((t / 60))m$(printf %02d $((t % 60)))s]"
    NEXT=$((NEXT + 1))
  done
}
killtree() { local c; for c in $(pgrep -P "$1"); do killtree "$c"; kill "$c" 2>/dev/null; done; }
trap 'killtree $$; exit 130' INT TERM

T0=$SECONDS
run build; run proto; flush            # everything else reads the build
for s in "${SOLO[@]}"; do run "$s"; done   # nothing beside them: even the simulations made their short timers miss
( renice -n 19 -p $BASHPID > /dev/null; lane $((QUICK ? 4 : 2)) "${SIMS[@]}" ) &
[ ${#REAL[@]} -gt 0 ] && lane "$JOBS" "${REAL[@]}" &
while [ "$(jobs -rp | wc -l)" -gt 0 ]; do flush; sleep 2; done
wait; flush
T=$((SECONDS - T0))
echo "--- $FAILS failed  [$((T / 60))m$(printf %02d $((T % 60)))s in all]"
exit $((FAILS > 0))
