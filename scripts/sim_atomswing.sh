#!/bin/bash
#
# AtomSwing resource-constrained Tailscale simulation (Docker + qemu-mipsel).
#
# Hardware reference (Ingenic T31, 128 MiB DRAM SIP):
#   Profile      Linux RAM   rmem      Source
#   swing-80m    80 MiB      48 MiB    AtomSwing stock (GitHub #74)
#   swing-92m    92 MiB      36 MiB    configs/kernel.config mem=92M
#
# Software constraints (overlay_rootfs/etc/init.d/S15swap):
#   swap file: 128 MiB on SD (/media/mmc/swap)
#   min_free_kbytes: 2048
#   /tmp: small RAM disk (~32 MiB on device)
#
# Docker maps:
#   mem_limit      = Linux RAM profile
#   memswap_limit  = RAM + 128 MiB swap
#   cpus=1         = single MIPS core approximation
#   tmpfs /tmp     = 32 MiB
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker/atomswing-sim/docker-compose.yml"
RESULTS_DIR="$ROOT/sim-results"
DEBUG_LOG="$ROOT/.cursor/debug-37748a.log"
SESSION_ID="37748a"
TAILSCALE_VERSION="1.96.4"
TAILSCALE_URL="https://dl.tailscale.com/stable/tailscale_${TAILSCALE_VERSION}_mipsle.tgz"
REAL_OSRELEASE="3.10.14__isvp_swan_1.0__"
NORM_OSRELEASE="3.10.14"

PROFILE="${1:-swing-80m}"
RUN_ID="sim-$(date +%Y%m%d_%H%M%S)"

case "$PROFILE" in
  swing-80m) SERVICE="atomswing-sim-80m"; MEM_MIB=80; RMEM_MIB=48 ;;
  swing-92m) SERVICE="atomswing-sim-92m"; MEM_MIB=92; RMEM_MIB=36 ;;
  *)
    echo "Unknown profile: $PROFILE (use swing-80m or swing-92m)" >&2
    exit 1
    ;;
esac

log_ndjson() {
  local hypothesis_id="$1" location="$2" message="$3" data="$4"
  mkdir -p "$RESULTS_DIR" "$(dirname "$DEBUG_LOG")"
  local line
  line=$(printf '{"sessionId":"%s","timestamp":%s,"hypothesisId":"%s","location":"%s","message":"%s","data":%s,"runId":"%s","profile":"%s"}\n' \
    "$SESSION_ID" "$(($(date +%s) * 1000))" "$hypothesis_id" "$location" "$message" "$data" "$RUN_ID" "$PROFILE")
  echo "$line" >> "$DEBUG_LOG"
  echo "$line" >> "$RESULTS_DIR/run.ndjson"
}

dc() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

ensure_container() {
  dc up -d --force-recreate "$SERVICE"
}

prepare_tailscale() {
  dc exec -T "$SERVICE" bash -s <<EOF
set -e
cd /work
cat > run_tailscale <<'WRAPPER'
#!/bin/bash
exec qemu-mipsel "\$(dirname "\$0")/tailscale-bin" "\$@"
WRAPPER
cat > run_tailscaled <<'WRAPPER'
#!/bin/bash
exec qemu-mipsel "\$(dirname "\$0")/tailscaled-bin" "\$@"
WRAPPER
chmod +x run_tailscale run_tailscaled

if [ ! -f tailscale-bin ]; then
  if [ ! -f "tailscale_${TAILSCALE_VERSION}_mipsle.tgz" ]; then
    wget -q -O "tailscale_${TAILSCALE_VERSION}_mipsle.tgz" "$TAILSCALE_URL"
  fi
  rm -rf extract
  mkdir -p extract
  gzip -dc "tailscale_${TAILSCALE_VERSION}_mipsle.tgz" | tar -xf - -C extract
  TS_DIR=\$(find extract -maxdepth 1 -type d -name 'tailscale_*' | head -1)
  cp "\$TS_DIR/tailscale" tailscale-bin
  cp "\$TS_DIR/tailscaled" tailscaled-bin
  chmod +x tailscale-bin tailscaled-bin
fi
file tailscale-bin tailscaled-bin
EOF
}

run_case() {
  local case_id="$1" osrelease="$2" baseline_mib="$3"
  dc exec -T "$SERVICE" bash -s <<EOF
set -e
cd /work
export CASE_ID="$case_id"
export OSRELEASE="$osrelease"
export BASELINE_MIB="$baseline_mib"

echo "=== Case \${CASE_ID}: osrelease=\${OSRELEASE} baseline=\${BASELINE_MIB}MiB ==="
OSRELEASE_RC=0
echo "\${OSRELEASE}" > /proc/sys/kernel/osrelease 2>/dev/null || OSRELEASE_RC=\$?
echo "osrelease now: \$(cat /proc/sys/kernel/osrelease) (write_rc=\${OSRELEASE_RC})"
UNAME_R=\$(uname -r)

BASELINE_PID=""
if [ "\${BASELINE_MIB}" -gt 0 ] 2>/dev/null; then
  python3 -c "
import ctypes, os, time, sys
n = int('\${BASELINE_MIB}') * 1024 * 1024
buf = ctypes.create_string_buffer(n)
sys.stdout.write(f'baseline allocated {n} bytes pid={os.getpid()}\n')
sys.stdout.flush()
time.sleep(3600)
" &
  BASELINE_PID=\$!
  sleep 1
fi

CGROUP_MAX=\$(cat /sys/fs/cgroup/memory.max 2>/dev/null || echo unknown)
CGROUP_CUR=\$(cat /sys/fs/cgroup/memory.current 2>/dev/null || echo unknown)
MEMINFO="cgroup_max=\${CGROUP_MAX} cgroup_cur=\${CGROUP_CUR} uname_r=\${UNAME_R}"

START=\$(date +%s%N)
set +e
VERSION_OUT=\$(./run_tailscale version 2>&1)
VERSION_RC=\$?
set -e
END=\$(date +%s%N)
VERSION_MS=\$(( (END - START) / 1000000 ))
if echo "\$VERSION_OUT" | grep -qiE 'fatal error|segmentation fault|cannot execute|panic'; then
  VERSION_RC=1
fi

DAEMON_RC=-1
DAEMON_RSS=0
DAEMON_MS=0
if [ "\$VERSION_RC" -eq 0 ]; then
  mkdir -p /tmp/tailscale-sim /run/tailscale-sim
  DSTART=\$(date +%s%N)
  ./run_tailscaled \\
    --state=/tmp/tailscale-sim/tailscaled.state \\
    --socket=/run/tailscale-sim/tailscaled.sock \\
    --port=41641 \\
    --tun=userspace-networking >/tmp/tailscale-sim/daemon.log 2>&1 &
  DPID=\$!
  for i in \$(seq 1 120); do
    if ./run_tailscale --socket=/run/tailscale-sim/tailscaled.sock status >/dev/null 2>&1; then
      DAEMON_RC=0
      break
    fi
    if grep -q 'Engine created' /tmp/tailscale-sim/daemon.log 2>/dev/null; then
      DAEMON_RC=0
      break
    fi
    if ! kill -0 "\$DPID" 2>/dev/null; then
      DAEMON_RC=1
      break
    fi
    sleep 1
  done
  [ "\$DAEMON_RC" -eq -1 ] && DAEMON_RC=2
  DEND=\$(date +%s%N)
  DAEMON_MS=\$(( (DEND - DSTART) / 1000000 ))
  if [ -d "/proc/\$DPID" ]; then
    DAEMON_RSS=\$(awk '/VmRSS/ {print \$2}' "/proc/\$DPID/status" 2>/dev/null || echo 0)
  fi
  kill "\$DPID" 2>/dev/null || true
  wait "\$DPID" 2>/dev/null || true
fi

[ -n "\$BASELINE_PID" ] && kill "\$BASELINE_PID" 2>/dev/null || true

VERSION_OUT_ESC=\$(printf '%s' "\$VERSION_OUT" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g' | tr '\n' ' ')
echo "__RESULT__{\"case\":\"\${CASE_ID}\",\"osrelease_target\":\"\${OSRELEASE}\",\"osrelease_write_rc\":\${OSRELEASE_RC},\"uname_r\":\"\${UNAME_R}\",\"version_rc\":\$VERSION_RC,\"version_ms\":\$VERSION_MS,\"version_out\":\"\${VERSION_OUT_ESC}\",\"daemon_rc\":\$DAEMON_RC,\"daemon_ms\":\$DAEMON_MS,\"daemon_rss_kb\":\$DAEMON_RSS,\"meminfo\":\"\${MEMINFO}\"}"
EOF
}

write_comparison() {
  cat > "$RESULTS_DIR/comparison.md" <<'COMPARE'
# AtomSwing Simulation vs Real Device

## Environment

| | Docker sim (qemu-mipsel) | Real device (atomcam33) |
|---|--------------------------|-------------------------|
| SoC | Ingenic T31 (emulated) | Ingenic T31 |
| Linux RAM | cgroup 80/92 MiB | mem=80M (~72 MiB available) |
| swap | memswap_limit (+128 MiB) | SD 128 MiB (/media/mmc/swap) |
| Kernel string | Host `uname -r` (7.x) | `3.10.14__isvp_swan_1.0__` |
| Binary exec | qemu-mipsel (~10-50x slower) | native MIPS |

## Known real-device results (prior verification)

| Test | Result |
|------|--------|
| `/usr/bin/tailscale version` (1.96.2 image) | Segmentation fault |
| SD 1.96.4 direct run | `fatal error: failed to parse kernel version from uname` |
| WebUI hack.ini save | OK |
| Tailscale dashboard | Device not registered (daemon never started) |

## Simulation limits

- **Case A (bad kernel string)**: Docker cannot override `uname -r` for qemu-mipsel; real-device parse failure is documented above.
- **Timings**: QEMU is not comparable to native MIPS; compare RSS and pass/fail only.
- **Case C**: Python malloc simulates rmem (48M on 80m profile, 36M on 92m).

## daemon_rc legend

| Value | Meaning |
|-------|---------|
| 0 | tailscaled started (status OK or "Engine created" in log) |
| 1 | tailscaled exited early |
| 2 | timeout waiting for daemon |

COMPARE
  for pf in swing-80m swing-92m; do
    f="$RESULTS_DIR/latest-${pf}.json"
    if [ -f "$f" ]; then
      echo "" >> "$RESULTS_DIR/comparison.md"
      echo "### Profile: $pf" >> "$RESULTS_DIR/comparison.md"
      echo '```json' >> "$RESULTS_DIR/comparison.md"
      cat "$f" >> "$RESULTS_DIR/comparison.md"
      echo '```' >> "$RESULTS_DIR/comparison.md"
    fi
  done
  echo "" >> "$RESULTS_DIR/comparison.md"
  echo "Generated: $(date -Iseconds)" >> "$RESULTS_DIR/comparison.md"
}

echo "=== AtomSwing simulation profile=$PROFILE service=$SERVICE run=$RUN_ID ==="
log_ndjson "spec" "sim:start" "profile" "{\"mem_mib\":$MEM_MIB,\"rmem_mib\":$RMEM_MIB,\"swap_mib\":128,\"tmp_mib\":32,\"tailscale\":\"$TAILSCALE_VERSION\"}"

ensure_container
prepare_tailscale

CASES=(
  "A|$REAL_OSRELEASE|0"
  "B|$NORM_OSRELEASE|0"
  "C|$NORM_OSRELEASE|$RMEM_MIB"
)

if [ "$PROFILE" = "swing-92m" ]; then
  CASES+=("D|$NORM_OSRELEASE|0")
fi

CASES+=("E|$NORM_OSRELEASE|0")

RESULTS_JSON="["
FIRST=1

for spec in "${CASES[@]}"; do
  IFS='|' read -r cid osrel baseline <<< "$spec"
  echo "--- Running case $cid ---"
  OUT=$(run_case "$cid" "$osrel" "$baseline" | grep '^__RESULT__' | sed 's/^__RESULT__//')
  log_ndjson "$cid" "sim:case" "result" "$OUT"
  if [ "$FIRST" -eq 1 ]; then
    RESULTS_JSON="${RESULTS_JSON}${OUT}"
    FIRST=0
  else
    RESULTS_JSON="${RESULTS_JSON},${OUT}"
  fi
done

RESULTS_JSON="${RESULTS_JSON}]"

mkdir -p "$RESULTS_DIR"
LATEST="$RESULTS_DIR/latest.json"
PROFILE_LATEST="$RESULTS_DIR/latest-${PROFILE}.json"
printf '{"runId":"%s","profile":"%s","timestamp":%s,"tailscale":"%s","cases":%s}\n' \
  "$RUN_ID" "$PROFILE" "$(date +%s)" "$TAILSCALE_VERSION" "$RESULTS_JSON" > "$LATEST"
cp "$LATEST" "$PROFILE_LATEST"

write_comparison

SUMMARY="$RESULTS_DIR/latest-summary.txt"
{
  echo "AtomSwing Tailscale Simulation Summary"
  echo "Run: $RUN_ID"
  echo "Profile: $PROFILE (${MEM_MIB}MiB RAM + 128MiB swap, /tmp 32MiB, 1 CPU)"
  echo "Tailscale: $TAILSCALE_VERSION mipsle (qemu-mipsel)"
  echo ""
  printf "%-6s %-8s %-10s %-12s %-10s %-12s\n" "Case" "version" "version_ms" "daemon_rc" "daemon_ms" "daemon_rss_kb"
  echo "$RESULTS_JSON" | python3 -c "
import json, sys
cases = json.load(sys.stdin)
for c in cases:
    print(f\"{c['case']:<6} {c['version_rc']:<8} {c['version_ms']:<10} {c['daemon_rc']:<12} {c.get('daemon_ms',0):<10} {c.get('daemon_rss_kb', 0)}\")
    if c['version_rc'] != 0 or 'fatal' in c.get('version_out','').lower():
        print(f\"       output: {c.get('version_out','')[:160]}\")
"
  echo ""
  echo "Compare: sim-results/comparison.md"
  echo "Real device: ssh root@<camera> 'sh -s' < scripts/verify_tailscale_on_device.sh"
  echo "Full JSON: $LATEST"
} > "$SUMMARY"

cat "$SUMMARY"
echo ""
echo "Results written to $LATEST"
