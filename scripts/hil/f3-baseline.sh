#!/bin/bash
# F-3 baseline: flash-fix, probe, extract iCamera_app binary.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CAM=root@10.0.0.228
OUT="$ROOT/sim-results/f3-baseline-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUT"
exec > >(tee "$OUT/run.log") 2>&1
echo "f3-baseline $(date -Is) out=$OUT"

cd "$ROOT"
bash scripts/hil/flash-fix.sh 2>&1 | tail -15 | tee "$OUT/flash-fix.tail"
export ATOMCAM_HOST=10.0.0.228
./scripts/hil/debug-hil-loop.sh probe 2>&1 | tail -5 || true
LATEST=$(ls -td "$ROOT"/sim-results/debug-hil-* 2>/dev/null | head -1)
[ -n "$LATEST" ] && cp -r "$LATEST" "$OUT/probe" 2>/dev/null || true

ssh -o BatchMode=yes -o ConnectTimeout=12 "$CAM" 'sh -s' <<'REMOTE' | tee "$OUT/camera-status.txt"
uptime
pidof iCamera_app || echo ICAM=none
md5sum /atom/system/bin/iCamera_app
cat /atom/configs/.product_config
dmesg 2>/dev/null | tail -15
REMOTE

ssh -o BatchMode=yes "$CAM" "cat /atom/system/bin/iCamera_app" > "$OUT/iCamera_app"
md5sum "$OUT/iCamera_app" | tee "$OUT/iCamera_app.md5"

echo "DONE baseline $OUT"
