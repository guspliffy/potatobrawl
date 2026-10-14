#!/usr/bin/env bash
# One command for all checks. Prints one PASS/FAIL line per check; details go to build/check-logs/.
#   ./check.sh          everything (about 5 minutes; the screenshot pass is the slow part)
#   ./check.sh --quick  build + PROTO + replay + lock + finish + combo routes + ultimates only (seconds)
# Needs: node, python3, `npm install` (ws), and Python Playwright matching the installed Chromium
# (in Claude's cloud container: python3 -m pip install playwright==1.56.0).
set -u
cd "$(dirname "$0")"
ROOT=$PWD
LOGS=$ROOT/build/check-logs
SHOTS=$ROOT/build/shots
mkdir -p "$LOGS" "$SHOTS/ux2"
QUICK=0; [ "${1:-}" = "--quick" ] && QUICK=1
FAILS=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1  (log: ${2#$ROOT/})"; FAILS=$((FAILS + 1)); }

# 1. Build. index.html is committed, so a source change without a rebuilt index.html shows up here.
if python3 game/build.py > "$LOGS/build.log" 2>&1; then
  if git diff --quiet -- index.html; then pass "build (index.html matches the committed one)"
  else pass "build (index.html changed: commit it with the source change)"; fi
else fail "build" "$LOGS/build.log"; fi

# 2. The deploy block checks the served page against GitHub's index.html, so it carries no PROTO to keep in step
#    (an old copy that grepped a PROTO number printed "still the old version" after every bump).
P=$(grep -o 'const PROTO = [0-9]*' game/ui/online.js)
if [ -n "$P" ] && grep -q "$P" index.html && ! grep -q 'const PROTO' deploy/update.txt && grep -q 'cmp -s - index.html' deploy/update.txt; then pass "PROTO (${P#const }) is in index.html; deploy/update.txt checks the served page"
else fail "PROTO / deploy block: index.html must carry '$P' and deploy/update.txt must compare the served page, not grep a PROTO" "deploy/update.txt"; fi

# 3. Replay determinism.
(cd tests && node snap.js) > "$LOGS/snap.log" 2>&1
if grep -q "mismatches: 0 /" "$LOGS/snap.log"; then pass "replay determinism (snap.js 0 mismatches)"
else fail "replay determinism" "$LOGS/snap.log"; fi

# 3b. Light-attack lock: longest run of unreactable jabs (defender reacts 14 frames after it can move),
#     plus save/restore checks while light-string launches happen.
(cd tests && node lockrun.js 14 && node lockdet.js) > "$LOGS/lock.log" 2>&1
RUN=$(grep -o 'longest run of hits[^:]*: [0-9]*' "$LOGS/lock.log" | grep -o '[0-9]*$')
if [ -n "$RUN" ] && [ "$RUN" -le 3 ] && grep -q "mismatches: 0," "$LOGS/lock.log"; then pass "light-attack lock (longest unreactable run $RUN hits, 0 save/restore mismatches)"
else fail "light-attack lock (longest run '${RUN:-?}', want 3 or less)" "$LOGS/lock.log"; fi

# 3c. Finish mode, charged heavies, KO at the hit: specials KO from the finish percent (not below), a tap is
#     unchanged, a full charge adds its damage, and every "this hit is a KO" call really ends in that KO.
(cd tests && node finish.js 30) > "$LOGS/finish.log" 2>&1
if grep -q "^finish ok" "$LOGS/finish.log"; then pass "finish mode + charge + KO at the hit ($(grep -o 'lethal calls [0-9]*' "$LOGS/finish.log"), 0 wrong)"
else fail "finish mode / charge / KO at the hit" "$LOGS/finish.log"; fi

# 3d. Combo routes and the link: every fighter lands each of its six routes on a standing CPU at the trial's damage, light,
#     light, special is a true combo at 0% and 30% (no jump or dodge escape after the second light), and combo damage scales.
(cd tests && node combos.js) > "$LOGS/combos.log" 2>&1
if grep -q "^combos ok" "$LOGS/combos.log"; then pass "combo routes + the link (all 13 routes land on every fighter that has them)"
else fail "combo routes / the link" "$LOGS/combos.log"; fi

# 3e. Ultimates: every ulti KOs the lightest and the heaviest fighter in its percent band (never from 0), the first hit lands 24+
#     frames after the freeze, the bar is spent on the press, a third use is refused, and save/restore mid-ulti matches.
(cd tests && node ulti.js) > "$LOGS/ulti.log" 2>&1
if grep -q "^ulti ok" "$LOGS/ulti.log"; then pass "ultimates (KO bands, first hit after the freeze, bar spent, save/restore mid-ulti)"
else fail "ultimates" "$LOGS/ulti.log"; fi

if [ $QUICK = 1 ]; then echo "--- quick run: $FAILS failed"; exit $((FAILS > 0)); fi

# 4. Balance: every fighter's bot win rate inside the band.
LO=${BAL_LO:-44}; HI=${BAL_HI:-57}
(cd tests && node bal7.js 80 0.5,0.8) > "$LOGS/balance.log" 2>&1
OUT=$(awk -v lo=$LO -v hi=$HI '/%$/ && NF==2 { v=$2+0; n++; if (v<lo||v>hi) bad=bad" "$1"="$2 } END { if (n==0) print "none"; else print bad }' "$LOGS/balance.log")
RANGE=$(awk '/%$/ && NF==2 { printf "%s %s  ", $1, $2 }' "$LOGS/balance.log")
if [ -z "$OUT" ]; then pass "balance ${LO}-${HI}%: $RANGE"
else fail "balance outside ${LO}-${HI}%:$OUT" "$LOGS/balance.log"; fi

# 4b. CPU fighting styles: each fighter's styled CPU against the neutral one, same fighter, stays between 35% and 65%.
(cd tests && node botstyle.js 100) > "$LOGS/botstyle.log" 2>&1
if grep -q "^botstyle ok" "$LOGS/botstyle.log"; then pass "CPU styles (styled vs neutral win rates inside 35-65%)"
else fail "CPU styles outside 35-65% against the neutral CPU" "$LOGS/botstyle.log"; fi

# 5. Online: two browsers play a match through a local server.
PORT=8091 KEEPALIVE_MINUTES=0 node server.js > "$LOGS/server.log" 2>&1 &
SRV=$!
sleep 1
(cd "$SHOTS" && timeout 300 python3 "$ROOT/tests/pwon.py") > "$LOGS/online.log" 2>&1
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null
if grep -q "^desyncs 0 0" "$LOGS/online.log" && grep -q "^rematch ok" "$LOGS/online.log" && grep -q "^no errors" "$LOGS/online.log"; then
  pass "online match (0 desyncs, rematch after the KO finisher, no page errors)"
else fail "online match" "$LOGS/online.log"; fi

# 5b. Accounts (sync codes): the server's endpoints and limits on port 8094 with a temporary folder, and the merge. Node only.
timeout 120 node tests/acct.js > "$LOGS/acct.log" 2>&1
if grep -q "^acct ok" "$LOGS/acct.log"; then pass "accounts server + merge ($(grep -c '^PASS' "$LOGS/acct.log") checks)"
else fail "accounts server + merge" "$LOGS/acct.log"; fi

# 6. Screens on small phone, phone and desktop, without page errors.
(cd "$SHOTS" && timeout 900 python3 "$ROOT/tests/pwux2.py" .) > "$LOGS/screens.log" 2>&1
if grep -q "^no errors" "$LOGS/screens.log"; then pass "screens 667x320, 844x390, 1280x760 (shots in build/shots/)"
else fail "screens" "$LOGS/screens.log"; fi

# 6b. Accounts in the browser: profile pill, Account sheet, two devices syncing through a real server (port 8093).
(cd "$SHOTS" && timeout 1200 python3 "$ROOT/tests/pwacct.py" acct) > "$LOGS/accounts-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/accounts-ui.log"; then pass "accounts in the browser (pill, sheet, two devices, conflict merge, accounts off; shots in build/shots/acct)"
else fail "accounts in the browser" "$LOGS/accounts-ui.log"; fi

# 6c. Match HUD (UI only): timer strip, pause icon under the opponent's card, YOU/CPU markers fading and coming back, percent tint,
#     danger edge glow for a hard launch of the player's own fighter, none in the KO finisher. Pictures in build/shots/hud.
(cd "$SHOTS" && timeout 1200 python3 "$ROOT/tests/pwhud.py" hud) > "$LOGS/hud.log" 2>&1
if grep -q "^no errors" "$LOGS/hud.log"; then pass "match HUD (layout, markers, percent tint, danger glow; shots in build/shots/hud)"
else fail "match HUD" "$LOGS/hud.log"; fi

# 6d. Ultimates on the HUD: the bar under both cards (empty, half, full, spent), the ULTI button only while full and clear of the
#     other buttons, a press by tap / U key / gamepad Y starts the ulti, reduced motion. Shots in build/shots/ult.
(cd "$SHOTS" && timeout 900 python3 "$ROOT/tests/pwult.py" ult) > "$LOGS/ult-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/ult-ui.log"; then pass "ulti bar + ULTI button (tap, U key, gamepad Y; shots in build/shots/ult)"
else fail "ulti bar + ULTI button" "$LOGS/ult-ui.log"; fi

# 6e. The guided first round: nine steps (Move ... Dodge, Ultimate, Knock them off) on desktop and four touch sizes. Shots in build/shots/tut.
(cd "$SHOTS" && timeout 1200 python3 "$ROOT/tests/pwtut.py" tut) > "$LOGS/tutorial.log" 2>&1
if grep -q "^no errors" "$LOGS/tutorial.log"; then pass "tutorial (nine steps incl. Dodge and Ultimate; shots in build/shots/tut)"
else fail "tutorial" "$LOGS/tutorial.log"; fi

# 7. KO finisher: one played through to the results screen, one skipped by a tap.
(cd "$SHOTS" && timeout 300 python3 "$ROOT/tests/pwfin.py" dragon && timeout 120 python3 "$ROOT/tests/pwfin.py" samurai --skip) > "$LOGS/finisher.log" 2>&1
if [ "$(grep -c "^no errors" "$LOGS/finisher.log")" = 2 ]; then pass "KO finisher (plays through, skips, results screen after)"
else fail "KO finisher" "$LOGS/finisher.log"; fi

# 8. Tournament: start a cup, win the quarter-final (chips paid, bracket moves on), lose the semi-final (no rating change), run it back,
#    leave, reload into a cup, forfeit from the pause menu.
(cd "$SHOTS" && timeout 600 python3 "$ROOT/tests/pwcup.py" cup flow) > "$LOGS/cup.log" 2>&1
if grep -q "^no errors" "$LOGS/cup.log"; then pass "tournament (bracket, chips, loss, run it back, reload, forfeit; no page errors)"
else fail "tournament" "$LOGS/cup.log"; fi

# 8b. Combos in the browser: route cards in How to play, the Combo trial (keys light up, cleared routes saved, hint after three
#     misses, Next, Exit), the Combo Potato reward paid once. Shots in build/shots/combo.
(cd "$SHOTS" && timeout 900 python3 "$ROOT/tests/pwcombo.py" combo) > "$LOGS/combo-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/combo-ui.log"; then pass "Combo trial in the browser (cards, trial, reward; shots in build/shots/combo)"
else fail "Combo trial in the browser" "$LOGS/combo-ui.log"; fi

# 8c. Daily Potato: the day's matchup on the menu, one try, a win pays 40 chips and grows the streak on the pill, a reload or a
#     forfeit can't give a second try, the next day brings a new matchup. Shots in build/shots/daily.
(cd "$SHOTS" && timeout 900 python3 "$ROOT/tests/pwdaily.py" daily) > "$LOGS/daily-ui.log" 2>&1
if grep -q "^no errors" "$LOGS/daily-ui.log"; then pass "Daily Potato in the browser (one try, chips, streak; shots in build/shots/daily)"
else fail "Daily Potato in the browser" "$LOGS/daily-ui.log"; fi

echo "--- $FAILS failed"
exit $((FAILS > 0))
