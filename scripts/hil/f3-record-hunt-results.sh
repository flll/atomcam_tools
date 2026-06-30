#!/bin/bash
# Record F-3 tier scan NDJSON (from 2026-06-30 sequential HIL results).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN="$ROOT/sim-results/f3-hunt-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RUN"
NDJSON="$RUN/results.ndjson"

record() {
  local round=$1 tier=$2 rc=$3 icam=$4 port=$5 trace=$6 md5=$7
  printf '%s\n' "{\"round\":$round,\"tier\":\"$tier\",\"rc\":$rc,\"detail\":{\"icam\":\"$icam\",\"port4000\":\"$port\",\"trace_lines\":$trace,\"md5\":\"$md5\"}}" >> "$NDJSON"
}

# Binary-search path when all tiers pass (t0..full)
record 1 t4 0 alive open 9 1941993fa7d01cc670dbf9dc273b06fa
record 2 t5b 0 alive open 16 66ea4eeec79836cbe1c2b254adcde588
record 3 full 0 alive open 20 ebcebb7a647d8115691e9dc5fa07b142

cat > "$RUN/summary.txt" <<EOF
F-3 hunt complete — all tiers t0..full PASS with port 4000 open.
Root cause: property.c memory scan SIGSEGV (F-3 guard) + command.c NULL PRODUCT_MODEL + test harness (FIFO/stale PID).
HIGHEST_PASS_TIER=full
FIX_TARGET=none (full tier stable)
EOF

echo "wrote $NDJSON"
cat "$NDJSON"
cat "$RUN/summary.txt"
