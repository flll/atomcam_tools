#!/bin/bash
set -uo pipefail
cd /home/lll/atomcam_tools
for t in t5a t5b full; do
  echo "TIER $t"
  sleep 60
  bash scripts/hil/flash-fix.sh 2>&1 | tail -2
  sleep 25
  bash scripts/hil/f3-chroot-test.sh "libcallback/libcallback.f3-${t}.so" "/tmp/f3-${t}-v2" 2>&1 | tail -12
  echo "rc=$?"
done
