#!/bin/bash
# Deploy atomcam_tools build artifacts to a live camera over SSH.
#
# usage: deploy_remote.sh [HOST] [--squashfs-only|--rollback|--status]
#
#   HOST            target hostname (default: $ATOMCAM_HOST, then atomcam.local)
#   (no flag)       full update: scp atomcam_tools.zip -> /media/mmc/update/
#   --squashfs-only scp target/rootfs_hack.squashfs -> /media/mmc/update/
#   --rollback      restore /media/mmc/rootfs_hack.squashfs.bak and reboot
#   --status        print current version / uptime / iCamera pid and exit
#
# exit codes: 0=success 10=transfer fail 20=boot timeout 30=version mismatch
# Final stdout line is one NDJSON object for machine parsing:
#   {"action":"deploy","host":...,"from":...,"to":...,"elapsed_s":...,"result":"ok|timeout|mismatch"}
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${ATOMCAM_HOST:-atomcam.local}"
MODE="deploy"
START_TS=$SECONDS

for arg in "$@"; do
  case "$arg" in
    --squashfs-only) MODE="squashfs" ;;
    --rollback)      MODE="rollback" ;;
    --status)        MODE="status" ;;
    --*)
      echo "unknown option: $arg" >&2
      echo "usage: $0 [HOST] [--squashfs-only|--rollback|--status]" >&2
      exit 10
      ;;
    *) HOST="$arg" ;;
  esac
done

remote() {
  ssh -o BatchMode=yes -o ConnectTimeout=10 "root@${HOST}" "$@"
}

remote_version() {
  remote 'cat /etc/atomhack.ver 2>/dev/null' 2>/dev/null | tr -d '\r' | head -1
}

emit_ndjson() {
  # emit_ndjson ACTION FROM TO RESULT
  printf '{"action":"%s","host":"%s","from":"%s","to":"%s","elapsed_s":%d,"result":"%s"}\n' \
    "$1" "$HOST" "$2" "$3" "$((SECONDS - START_TS))" "$4"
}

finish() {
  # finish ACTION FROM TO RESULT EXIT_CODE
  emit_ndjson "$1" "$2" "$3" "$4"
  exit "$5"
}

wait_for_boot() {
  # wait_for_boot TIMEOUT_S -> 0 when iCamera_app is up, 1 on timeout
  local timeout="$1" deadline=$((SECONDS + $1)) ping_deadline=$((SECONDS + 70))
  echo "waiting for reboot (timeout ${timeout}s) ..."
  sleep 15  # let the reboot actually start before probing

  while ((SECONDS < deadline)); do
    if ! ping -c 1 -W 2 "$HOST" >/dev/null 2>&1; then
      if ((SECONDS > ping_deadline)); then
        echo "still no ping response from ${HOST} ..."
        ping_deadline=$((SECONDS + 60))
      fi
      sleep 3
      continue
    fi
    if remote 'pidof iCamera_app >/dev/null 2>&1' 2>/dev/null; then
      echo "iCamera_app is running"
      return 0
    fi
    sleep 5
  done
  return 1
}

if [ "$MODE" = "status" ]; then
  if ! remote 'echo ok' >/dev/null 2>&1; then
    echo "SSH to root@${HOST} failed"
    emit_ndjson "status" "" "" "unreachable"
    exit 1
  fi
  VER="$(remote_version)"
  UPTIME="$(remote 'uptime' 2>/dev/null | tr -d '\r')"
  PID="$(remote 'pidof iCamera_app 2>/dev/null' 2>/dev/null | tr -d '\r')"
  echo "host:    ${HOST}"
  echo "version: ${VER:-unknown}"
  echo "uptime:  ${UPTIME}"
  echo "icamera: ${PID:-not running}"
  if [ -n "$PID" ]; then
    emit_ndjson "status" "$VER" "$VER" "ok"
    exit 0
  fi
  emit_ndjson "status" "$VER" "$VER" "icamera-down"
  exit 1
fi

EXPECTED="$(tr -d '[:space:]' < "$ROOT/configs/atomhack.ver")"

if ! remote 'echo ok' >/dev/null 2>&1; then
  echo "SSH to root@${HOST} failed" >&2
  finish "$MODE" "" "" "transfer-fail" 10
fi
FROM_VER="$(remote_version)"
echo "current version on ${HOST}: ${FROM_VER:-unknown} (local build: ${EXPECTED})"

case "$MODE" in
  deploy)
    SRC="$ROOT/atomcam_tools.zip"
    DST="/media/mmc/update/atomcam_tools.zip"
    TIMEOUT=300
    ;;
  squashfs)
    SRC="$ROOT/target/rootfs_hack.squashfs"
    DST="/media/mmc/update/rootfs_hack.squashfs"
    TIMEOUT=180
    ;;
  rollback)
    SRC=""
    TIMEOUT=180
    ;;
esac

if [ "$MODE" = "rollback" ]; then
  echo "rolling back to /media/mmc/rootfs_hack.squashfs.bak ..."
  if ! remote '[ -f /media/mmc/rootfs_hack.squashfs.bak ]'; then
    echo "no backup found on device" >&2
    finish "rollback" "$FROM_VER" "" "transfer-fail" 10
  fi
  if ! remote 'mkdir -p /media/mmc/update && cp /media/mmc/rootfs_hack.squashfs.bak /media/mmc/update/rootfs_hack.squashfs && sync'; then
    echo "rollback copy failed" >&2
    finish "rollback" "$FROM_VER" "" "transfer-fail" 10
  fi
else
  if [ ! -f "$SRC" ]; then
    echo "artifact not found: $SRC (run make build first)" >&2
    finish "$MODE" "$FROM_VER" "$EXPECTED" "transfer-fail" 10
  fi
  echo "backing up rootfs_hack.squashfs on device ..."
  remote '[ -f /media/mmc/rootfs_hack.squashfs ] && cp /media/mmc/rootfs_hack.squashfs /media/mmc/rootfs_hack.squashfs.bak; mkdir -p /media/mmc/update' \
    || { echo "device-side backup failed" >&2; finish "$MODE" "$FROM_VER" "$EXPECTED" "transfer-fail" 10; }
  echo "transferring $(basename "$SRC") -> ${HOST}:${DST} ..."
  if ! scp -O -o BatchMode=yes -o ConnectTimeout=10 "$SRC" "root@${HOST}:${DST}"; then
    echo "scp failed" >&2
    finish "$MODE" "$FROM_VER" "$EXPECTED" "transfer-fail" 10
  fi
  remote 'sync' || true
fi

echo "rebooting ${HOST} ..."
remote 'sync; reboot' 2>/dev/null || true

if ! wait_for_boot "$TIMEOUT"; then
  echo "boot timeout after ${TIMEOUT}s" >&2
  finish "$MODE" "$FROM_VER" "" "timeout" 20
fi

TO_VER="$(remote_version)"
echo "version after reboot: ${TO_VER:-unknown}"

if [ "$MODE" = "rollback" ]; then
  finish "rollback" "$FROM_VER" "$TO_VER" "ok" 0
fi

if [ "$TO_VER" != "$EXPECTED" ]; then
  echo "version mismatch: expected ${EXPECTED}, got ${TO_VER:-unknown}" >&2
  finish "$MODE" "$FROM_VER" "$TO_VER" "mismatch" 30
fi

finish "$MODE" "$FROM_VER" "$TO_VER" "ok" 0
