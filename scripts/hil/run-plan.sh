#!/bin/bash
# Orchestrate flash-fix then F-3 when camera is reachable
set -u
ROOT=/home/lll/atomcam_tools
LOG="$ROOT/sim-results/run-plan-$(date +%Y%m%d_%H%M%S).log"
exec > >(tee "$LOG") 2>&1
echo "run-plan $(date -Is)"

for round in $(seq 1 30); do
  echo "=== round $round ==="
  if bash "$ROOT/scripts/hil/flash-fix.sh"; then
    echo "flash-fix ok"
    ok=0
    for j in $(seq 1 15); do
      if ssh -o BatchMode=yes -o ConnectTimeout=5 root@10.0.0.228 true 2>/dev/null; then
        ok=$((ok+1))
      else
        ok=0
      fi
      sleep 4
    done
    echo "stable=$ok/15"
    if [ "$ok" -ge 10 ]; then
      bash "$ROOT/scripts/hil/f3-preload-test.sh" || true
      ssh -o BatchMode=yes -o ConnectTimeout=8 root@10.0.0.228 \
        'dmesg 2>/dev/null | grep -iE segv|page_fault|iCamera | tail -15' || true
      echo "DONE round $round"
      exit 0
    fi
  fi
  sleep 30
done
echo "FATAL: 30 rounds exhausted"
exit 1
