#!/bin/bash
# collect_perf_remote.sh HOST LABEL — 実機の perf 計測(ブートタイムライン/サンプラリング/現況)を回収する。
#
# 出力: sim-results/perf/<ts>-<label>-<commit>/
#   boot_timeline.ndjson  rcS 計装の S* 別タイムライン(+icamera_ready/boot_total)
#   ring.ndjson           perf_sampler の tmpfs リング(古い面から連結)
#   diskstats.txt free.txt ps.txt loadavg.txt df.txt
# 比較: scripts/perf_report.sh BEFORE_DIR AFTER_DIR
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${1:?usage: collect_perf_remote.sh HOST LABEL}"
LABEL="${2:?usage: collect_perf_remote.sh HOST LABEL}"
COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$ROOT/sim-results/perf/$TS-$LABEL-$COMMIT"

R() { ssh -n -o BatchMode=yes -o ConnectTimeout=10 "root@$HOST" "$@"; }

R 'true' || { echo "ERROR: $HOST unreachable"; exit 1; }
mkdir -p "$OUT"

R 'cat /tmp/boot_timeline.ndjson 2>/dev/null' > "$OUT/boot_timeline.ndjson" || true
R 'cat /tmp/perf/ring.ndjson.3 /tmp/perf/ring.ndjson.2 /tmp/perf/ring.ndjson.1 /tmp/perf/ring.ndjson 2>/dev/null' > "$OUT/ring.ndjson" || true
R 'cat /proc/diskstats' > "$OUT/diskstats.txt" || true
R 'free' > "$OUT/free.txt" || true
R 'ps w' > "$OUT/ps.txt" || true
R 'uptime; cat /proc/loadavg' > "$OUT/loadavg.txt" || true
R 'df -k' > "$OUT/df.txt" || true

echo "collected -> $OUT"
wc -l "$OUT"/*.ndjson 2>/dev/null || true
