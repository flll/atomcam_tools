#!/bin/bash
# Collect Tailscale runtime evidence from atomcam and append NDJSON to debug log.
set -euo pipefail

HOST="${1:-atomcam33}"
DEBUG_LOG="/home/lll/atomcam_tools/.cursor/debug-37748a.log"
SESSION_ID="37748a"
RUN_ID="${2:-verify-$(date +%Y%m%d_%H%M%S)}"

log_host() {
    local hypothesis_id="$1" location="$2" message="$3" data="$4"
    printf '{"sessionId":"%s","timestamp":%s,"hypothesisId":"%s","location":"%s","message":"%s","data":%s,"runId":"%s"}\n' \
        "$SESSION_ID" "$(($(date +%s) * 1000))" "$hypothesis_id" "$location" "$message" "$data" "$RUN_ID" >> "$DEBUG_LOG"
}

remote() {
    ssh -o BatchMode=yes -o ConnectTimeout=10 "root@${HOST}" "$@"
}

echo "=== Tailscale remote verify: ${HOST} run=${RUN_ID} ==="

if ! remote 'echo ok' >/dev/null 2>&1; then
    log_host "SSH" "verify:connect" "ssh failed" "{\"host\":\"${HOST}\"}"
    echo "SSH to root@${HOST} failed"
    exit 1
fi
log_host "SSH" "verify:connect" "ssh ok" "{\"host\":\"${HOST}\"}"

# Pull device-side debug log if present
remote 'cat /tmp/ts_debug.ndjson 2>/dev/null || true' >> "$DEBUG_LOG" || true

UNAME="$(remote 'uname -a' | tr -d '\r')"
OSRELEASE="$(remote 'cat /proc/sys/kernel/osrelease' | tr -d '\r')"
WRITABLE="$(remote '[ -w /proc/sys/kernel/osrelease ] && echo true || echo false' | tr -d '\r')"
log_host "A" "verify:kernel" "kernel info" "{\"uname\":\"${UNAME}\",\"osrelease\":\"${OSRELEASE}\",\"osrelease_writable\":${WRITABLE}}"

# Binary on system (may be old image)
VERSION_OUT="$(remote '/usr/bin/tailscale version 2>&1 | head -3' | tr -d '\r' | sed 's/"/\\"/g')"
VERSION_RC="$(remote '/usr/bin/tailscale version >/dev/null 2>&1; echo $?' | tr -d '\r')"
log_host "A" "verify:binary" "usr/bin/tailscale version" "{\"rc\":${VERSION_RC},\"output\":\"${VERSION_OUT}\"}"

# osrelease patch experiment
PATCH_RC="$(remote 'echo 3.10.14 > /proc/sys/kernel/osrelease 2>&1; echo $?' | tail -1 | tr -d '\r')"
AFTER_RELEASE="$(remote 'cat /proc/sys/kernel/osrelease' | tr -d '\r')"
VERSION2_OUT="$(remote '/usr/bin/tailscale version 2>&1 | head -3' | tr -d '\r' | sed 's/"/\\"/g')"
VERSION2_RC="$(remote '/usr/bin/tailscale version >/dev/null 2>&1; echo $?' | tr -d '\r')"
log_host "A" "verify:binary_patched" "tailscale version after osrelease patch" "{\"patch_rc\":${PATCH_RC},\"osrelease_after\":\"${AFTER_RELEASE}\",\"rc\":${VERSION2_RC},\"output\":\"${VERSION2_OUT}\"}"

# SD test binary if available
SD_BIN="/media/mmc/ts_test/x/tailscale_1.96.4_mipsle/tailscale"
if remote "[ -x '${SD_BIN}' ]"; then
    SD_OUT="$(remote "'${SD_BIN}' version 2>&1 | head -3" | tr -d '\r' | sed 's/"/\\"/g')"
    SD_RC="$(remote "'${SD_BIN}' version >/dev/null 2>&1; echo \$?" | tr -d '\r')"
    log_host "B" "verify:sd_binary" "SD 1.96.4 binary" "{\"rc\":${SD_RC},\"output\":\"${SD_OUT}\"}"
fi

# hack.ini tailscale config (no secrets)
TS_ENABLE="$(remote "awk -F= '/^TAILSCALE_ENABLE=/ {print \$2}' /tmp/hack.ini 2>/dev/null | tr -d '\r'")"
TS_HOST="$(remote "awk -F= '/^TAILSCALE_HOSTNAME=/ {print \$2}' /tmp/hack.ini 2>/dev/null | tr -d '\r'")"
log_host "E" "verify:config" "hack.ini tailscale" "{\"enable\":\"${TS_ENABLE}\",\"hostname\":\"${TS_HOST}\"}"

# Process / memory benchmark
FREE_MEM="$(remote 'free -m | awk "/Mem:/ {print \$2,\$3,\$4}"' | tr -d '\r')"
TS_PS="$(remote 'ps -o pid,rss,vsz,pcpu,comm 2>/dev/null | grep -E "tailscale|PID" || echo none' | tr -d '\r' | sed 's/"/\\"/g')"
log_host "C" "verify:resources" "memory and processes" "{\"free_mb\":\"${FREE_MEM}\",\"ps\":\"${TS_PS}\"}"

# tailscale status if daemon running
if remote 'pgrep -f tailscaled >/dev/null 2>&1'; then
    STATUS="$(remote '/usr/bin/tailscale status 2>&1 | head -5' | tr -d '\r' | sed 's/"/\\"/g')"
    log_host "E" "verify:status" "tailscale status" "{\"output\":\"${STATUS}\"}"
else
    log_host "E" "verify:status" "tailscaled not running" "{}"
fi

# atomhack.log tail (reboot loop check)
HACKLOG="$(remote 'tail -5 /media/mmc/atomhack.log 2>/dev/null || tail -5 /tmp/atomhack.log 2>/dev/null || echo missing' | tr -d '\r' | sed 's/"/\\"/g')"
log_host "D" "verify:stability" "atomhack.log tail" "{\"log\":\"${HACKLOG}\"}"

echo "Done. Logs appended to ${DEBUG_LOG}"
