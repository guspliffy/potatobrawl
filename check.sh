#!/usr/bin/env bash
# One command for all checks. Prints one PASS/FAIL line per check; details go to build/check-logs/.
#   ./check.sh          everything (about 5 minutes; the screenshot pass is the slow part)
#   ./check.sh --quick  build + PROTO + replay + lock only (seconds)
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

# 2. PROTO in the game must match the line deploy/update.txt looks for.
P=$(grep -o 'const PROTO = [0-9]*' game/ui/online.js)
if [ -n "$P" ] && grep -q "$P" deploy/update.txt; then pass "PROTO (${P#const }) matches deploy/update.txt"
else fail "PROTO: game has '$P', deploy/update.txt greps something else" "deploy/update.txt"; fi

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

if [ $QUICK = 1 ]; then echo "--- quick run: $FAILS failed"; exit $((FAILS > 0)); fi

# 4. Balance: every fighter's bot win rate inside the band.
LO=${BAL_LO:-44}; HI=${BAL_HI:-57}
(cd tests && node bal7.js 80 0.5,0.8) > "$LOGS/balance.log" 2>&1
OUT=$(awk -v lo=$LO -v hi=$HI '/%$/ && NF==2 { v=$2+0; n++; if (v<lo||v>hi) bad=bad" "$1"="$2 } END { if (n==0) print "none"; else print bad }' "$LOGS/balance.log")
RANGE=$(awk '/%$/ && NF==2 { printf "%s %s  ", $1, $2 }' "$LOGS/balance.log")
if [ -z "$OUT" ]; then pass "balance ${LO}-${HI}%: $RANGE"
else fail "balance outside ${LO}-${HI}%:$OUT" "$LOGS/balance.log"; fi

# 5. Online: two browsers play a match through a local server.
PORT=8091 KEEPALIVE_MINUTES=0 node server.js > "$LOGS/server.log" 2>&1 &
SRV=$!
sleep 1
(cd "$SHOTS" && timeout 300 python3 "$ROOT/tests/pwon.py") > "$LOGS/online.log" 2>&1
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null
if grep -q "^desyncs 0 0" "$LOGS/online.log" && grep -q "^rematch ok" "$LOGS/online.log" && grep -q "^no errors" "$LOGS/online.log"; then
  pass "online match (0 desyncs, rematch after the KO finisher, no page errors)"
else fail "online match" "$LOGS/online.log"; fi

# 6. Screens on small phone, phone and desktop, without page errors.
(cd "$SHOTS" && timeout 600 python3 "$ROOT/tests/pwux2.py" .) > "$LOGS/screens.log" 2>&1
if grep -q "^no errors" "$LOGS/screens.log"; then pass "screens 667x320, 844x390, 1280x760 (shots in build/shots/)"
else fail "screens" "$LOGS/screens.log"; fi

# 7. KO finisher: one played through to the results screen, one skipped by a tap.
(cd "$SHOTS" && timeout 300 python3 "$ROOT/tests/pwfin.py" dragon && timeout 120 python3 "$ROOT/tests/pwfin.py" samurai --skip) > "$LOGS/finisher.log" 2>&1
if [ "$(grep -c "^no errors" "$LOGS/finisher.log")" = 2 ]; then pass "KO finisher (plays through, skips, results screen after)"
else fail "KO finisher" "$LOGS/finisher.log"; fi

echo "--- $FAILS failed"
exit $((FAILS > 0))
