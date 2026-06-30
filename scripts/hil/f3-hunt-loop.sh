#!/bin/bash
# F-3 hunt loop: binary search over tiers t0..full (max 5 rounds).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN="$ROOT/sim-results/f3-hunt-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RUN"
NDJSON="$RUN/results.ndjson"
exec > >(tee "$RUN/run.log") 2>&1
echo "f3-hunt-loop $(date -Is) run=$RUN"

TIERS=(t0 t1 t2 t3 t4 t5 t5a t5b full)
LOW=0
HIGH=$((${#TIERS[@]} - 1))
ROUND=0
MAX_ROUNDS=5
PASS_TIER=""
PASS_SO=""

while [ "$ROUND" -lt "$MAX_ROUNDS" ] && [ "$LOW" -le "$HIGH" ]; do
  ROUND=$((ROUND + 1))
  MID=$(( (LOW + HIGH) / 2 ))
  TIER="${TIERS[$MID]}"
  echo "=== round $ROUND tier=$TIER (low=$LOW high=$HIGH mid=$MID) ==="
  LOGDIR="$RUN/round-${ROUND}-${TIER}"
  mkdir -p "$LOGDIR"

  "$ROOT/scripts/hil/build_libcallback_tier.sh" "$TIER"
  SO="$ROOT/libcallback/libcallback.f3-${TIER}.so"
  [ -f "$SO" ] || { echo "FATAL: missing $SO"; exit 2; }

  set +e
  JSON=$("$ROOT/scripts/hil/f3-chroot-test.sh" "$SO" "$LOGDIR" 2>&1 | tail -1)
  RC=$?
  set -e
  echo "{\"round\":$ROUND,\"tier\":\"$TIER\",\"low\":$LOW,\"high\":$HIGH,\"rc\":$RC,\"detail\":$JSON}" >> "$NDJSON"
  echo "round=$ROUND rc=$RC json=$JSON"

  if [ "$RC" -eq 0 ]; then
    PASS_TIER="$TIER"
    PASS_SO="$SO"
    LOW=$((MID + 1))
  else
    HIGH=$((MID - 1))
  fi
  sleep 10
done

echo "=== hunt summary ==="
echo "pass_tier=${PASS_TIER:-none}"
echo "fail_boundary_tier=${TIERS[$HIGH]:-none} (first failing at or above)"
cat "$NDJSON"

if [ -n "$PASS_TIER" ]; then
  echo "HIGHEST_PASS_TIER=$PASS_TIER"
  "$ROOT/scripts/hil/f3-chroot-test.sh" "$PASS_SO" "$RUN/validate-pass" 2>&1 | tail -5
fi

if [ -n "$PASS_TIER" ] && [ "$PASS_TIER" = "full" ]; then
  PORT_OK=$("$ROOT/scripts/hil/f3-chroot-test.sh" "$PASS_SO" "$RUN/validate-full" 2>&1 | grep '^PORT=' | grep -c ':4000' || true)
  if [ "${PORT_OK:-0}" -gt 0 ]; then
    echo "SUCCESS: full tier + port4000"
    exit 0
  fi
  echo "full tier alive but port4000 closed — fix tier modules"
fi

# If highest passing tier found, test next tier explicitly for fix target
if [ -n "$PASS_TIER" ]; then
  IDX=0
  for i in "${!TIERS[@]}"; do
    [ "${TIERS[$i]}" = "$PASS_TIER" ] && IDX=$i
  done
  NEXT=$((IDX + 1))
  if [ "$NEXT" -lt "${#TIERS[@]}" ]; then
    FAIL_TIER="${TIERS[$NEXT]}"
    echo "FIX_TARGET: tier $FAIL_TIER (first crash above passing $PASS_TIER)"
    "$ROOT/scripts/hil/build_libcallback_tier.sh" "$FAIL_TIER"
    echo "$FAIL_TIER" > "$RUN/fix_target_tier.txt"
  fi
fi

exit 1
