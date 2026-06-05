#!/bin/sh
# Run ON atomcam (e.g. ssh root@atomcam33 'sh -s' < scripts/verify_tailscale_on_device.sh)
TS_DEBUG_LOG="/tmp/ts_debug.ndjson"
SD_BIN="/media/mmc/ts_test/x/tailscale_1.96.4_mipsle/tailscale"

log() {
    hid="$1"; loc="$2"; msg="$3"; data="$4"
    printf '{"sessionId":"37748a","timestamp":%s,"hypothesisId":"%s","location":"%s","message":"%s","data":%s,"runId":"device-manual"}\n' \
        "$(($(date +%s) * 1000))" "$hid" "$loc" "$msg" "$data" >> "$TS_DEBUG_LOG"
}

: > "$TS_DEBUG_LOG"

log "A" "device:kernel" "kernel info" "{\"uname\":\"$(uname -a | tr -d '\r')\",\"osrelease\":\"$(cat /proc/sys/kernel/osrelease)\",\"writable\":$([ -w /proc/sys/kernel/osrelease ] && echo true || echo false)}"

echo "=== /usr/bin/tailscale version (before patch) ==="
/usr/bin/tailscale version 2>&1 | head -3
rc=$?
log "A" "device:usr_bin" "before patch" "{\"rc\":$rc}"

if [ -w /proc/sys/kernel/osrelease ]; then
    echo 3.10.14 > /proc/sys/kernel/osrelease 2>/dev/null
    log "A" "device:patch" "osrelease patched" "{\"after\":\"$(cat /proc/sys/kernel/osrelease)\"}"
fi

echo "=== /usr/bin/tailscale version (after patch) ==="
/usr/bin/tailscale version 2>&1 | head -3
rc2=$?
log "A" "device:usr_bin" "after patch" "{\"rc\":$rc2}"

if [ -x "$SD_BIN" ]; then
    echo "=== SD 1.96.4 binary ==="
    "$SD_BIN" version 2>&1 | head -3
    rc3=$?
    log "B" "device:sd_bin" "SD binary" "{\"rc\":$rc3}"
fi

echo "=== free -m ==="
free -m
log "C" "device:mem" "free" "{\"mem\":\"$(free -m | awk '/Mem:/ {print $2,$3,$4}')\"}"

echo "=== tailscale processes ==="
ps | grep -E '[t]ailscale' || echo "(none)"
log "C" "device:ps" "processes" "{\"count\":$(ps | grep -c '[t]ailscale' || echo 0)}"

echo "=== hack.ini (no secrets) ==="
awk -F= '/^TAILSCALE_/ && $1 != "TAILSCALE_AUTH_KEY" {print}' /tmp/hack.ini 2>/dev/null

echo "=== atomhack.log tail ==="
tail -5 /media/mmc/atomhack.log 2>/dev/null || tail -5 /tmp/atomhack.log 2>/dev/null

echo "=== debug log: $TS_DEBUG_LOG ==="
cat "$TS_DEBUG_LOG"
