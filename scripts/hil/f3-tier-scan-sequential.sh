#!/bin/bash
# Sequential tier scan with recovery between tests (safe for unstable camera).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
RUN="$ROOT/sim-results/f3-tier-scan-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RUN"
NDJSON="$RUN/results.ndjson"
GAP="${F3_TIER_GAP:-90}"

echo "tier-scan $(date -Is) run=$RUN gap=${GAP}s" | tee "$RUN/run.log"

bash scripts/hil/flash-fix.sh 2>&1 | tail -5 | tee -a "$RUN/run.log"
sleep 30

for t in t0 t1 t2 t3 t4 t5 t5a t5b full; do
  echo "=== TIER $t $(date -Is) ===" | tee -a "$RUN/run.log"
  bash scripts/hil/build_libcallback_tier.sh "$t" 2>&1 | tail -2 | tee -a "$RUN/run.log"
  SO="libcallback/libcallback.f3-${t}.so"
  LOGDIR="$RUN/${t}"
  set +e
  OUT=$(bash scripts/hil/f3-chroot-test.sh "$SO" "$LOGDIR" 2>&1)
  RC=$?
  set -e
  JSON=$(echo "$OUT" | tail -1)
  echo "$OUT" | tee -a "$RUN/run.log"
  echo "{\"tier\":\"$t\",\"rc\":$RC,\"detail\":$JSON}" >> "$NDJSON"
  echo "tier=$t rc=$RC" | tee -a "$RUN/run.log"
  if [ "$RC" -ne 0 ]; then
    echo "FAIL at $t — stopping scan" | tee -a "$RUN/run.log"
    break
  fi
  echo "sleep ${GAP}s before next tier" | tee -a "$RUN/run.log"
  sleep "$GAP"
  bash scripts/hil/flash-fix.sh 2>&1 | tail -2 | tee -a "$RUN/run.log"
  sleep 20
done

echo "DONE scan=$RUN" | tee -a "$RUN/run.log"
cat "$NDJSON"
