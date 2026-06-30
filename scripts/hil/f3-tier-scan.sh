#!/bin/bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
bash scripts/hil/flash-fix.sh 2>&1 | tail -3
for t in t0 t3 t5 t5a t5b full; do
  echo "TIER $t"
  bash scripts/hil/build_libcallback_tier.sh "$t" 2>&1 | tail -1
  bash scripts/hil/f3-chroot-test.sh "libcallback/libcallback.f3-${t}.so" "/tmp/f3-${t}" 2>&1 | tail -12 || true
  echo "test_exit=$?"
  sleep 15
done
