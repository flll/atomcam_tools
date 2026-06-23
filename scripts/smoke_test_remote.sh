#!/bin/bash
# Smoke-test a live camera after deploy. Emits one NDJSON line per case to stdout.
#
# usage: smoke_test_remote.sh [HOST] [EXPECTED_VERSION]
#
#   HOST              target hostname (default: $ATOMCAM_HOST, then atomcam.local)
#   EXPECTED_VERSION  optional; when set, the version case compares against it
#
# NDJSON format (one object per case):
#   {"case":"icamera","result":"pass|fail|skip","host":...,"timestamp":...,"data":{...}}
#
# On any failure, debug material (atomhack.log / dmesg / ps / hack.ini) is
# collected into sim-results/deploy-<timestamp>/ .
# exit code: 0 = all cases pass (skip allowed), 1 = at least one failure
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/scripts/hil/agent-debug-log.sh"
HOST="${1:-${ATOMCAM_HOST:-atomcam.local}}"
EXPECTED="${2:-}"
FAILED=0

remote() {
  ssh -o BatchMode=yes -o ConnectTimeout=10 "root@${HOST}" "$@"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\r' | tr '\n' ' '
}

report() {
  # report CASE RESULT DATA_JSON
  printf '{"case":"%s","result":"%s","host":"%s","timestamp":%s,"data":%s}\n' \
    "$1" "$2" "$HOST" "$(date +%s)" "$3"
  [ "$2" = "fail" ] && FAILED=1
}

# --- connectivity precondition -------------------------------------------
if ! remote 'echo ok' >/dev/null 2>&1; then
  report "ssh" "fail" "{\"error\":\"ssh unreachable\"}"
  exit 1
fi

# --- case: version ---------------------------------------------------------
VER="$(remote 'cat /etc/atomhack.ver 2>/dev/null' | tr -d '\r' | head -1)"
if [ -z "$VER" ]; then
  report "version" "fail" "{\"version\":\"\",\"expected\":\"$(json_escape "$EXPECTED")\"}"
elif [ -n "$EXPECTED" ] && [ "$VER" != "$EXPECTED" ]; then
  report "version" "fail" "{\"version\":\"$(json_escape "$VER")\",\"expected\":\"$(json_escape "$EXPECTED")\"}"
else
  report "version" "pass" "{\"version\":\"$(json_escape "$VER")\",\"expected\":\"$(json_escape "$EXPECTED")\"}"
fi

# --- case: icamera ----------------------------------------------------------
ICAM_PID="$(remote 'pidof iCamera_app 2>/dev/null' | tr -d '\r')"
LOG_ERRORS="$(remote 'tail -50 /media/mmc/atomhack.log 2>/dev/null | grep -ciE "error|fail|segfault" || true' | tr -d '\r')"
if [ -n "$ICAM_PID" ]; then
  report "icamera" "pass" "{\"pid\":\"$(json_escape "$ICAM_PID")\",\"recent_log_errors\":${LOG_ERRORS:-0}}"
else
  report "icamera" "fail" "{\"pid\":\"\",\"recent_log_errors\":${LOG_ERRORS:-0}}"
fi

# --- case: webui -------------------------------------------------------------
WEBUI_RC=0
WEBUI_OUT="$(curl -sf -m 10 "http://${HOST}/cgi-bin/hack_ini.cgi" 2>&1 | head -3)" || WEBUI_RC=$?
if [ "$WEBUI_RC" -eq 0 ]; then
  report "webui" "pass" "{\"rc\":0}"
else
  report "webui" "fail" "{\"rc\":${WEBUI_RC},\"output\":\"$(json_escape "$WEBUI_OUT")\"}"
fi

# --- case: rtsp --------------------------------------------------------------
RTSP_ENABLE="$(remote "awk -F= '/^RTSP *=/ {print \$2}' /tmp/hack.ini 2>/dev/null" | tr -d '\r')"
if ! nc -z -w 5 "$HOST" 8554 2>/dev/null; then
  if [ "$RTSP_ENABLE" = "on" ]; then
    report "rtsp" "fail" "{\"port_open\":false,\"rtsp_enable\":\"$(json_escape "$RTSP_ENABLE")\"}"
  else
    report "rtsp" "skip" "{\"port_open\":false,\"rtsp_enable\":\"$(json_escape "$RTSP_ENABLE")\"}"
  fi
elif command -v ffprobe >/dev/null 2>&1; then
  FRAME_RC=0
  agent_debug_log "C" "smoke_test_remote.sh:rtsp" "ffprobe_start" "{\"host\":\"$HOST\"}" "pre-fix"
  if command -v timeout >/dev/null 2>&1; then
    timeout 20 ffprobe -v error -rtsp_transport tcp -select_streams v:0 -show_frames -read_intervals '%+#1' \
      "rtsp://${HOST}:8554/unicast" >/dev/null 2>&1 || FRAME_RC=$?
  else
    ffprobe -v error -rtsp_transport tcp -select_streams v:0 -show_frames -read_intervals '%+#1' \
      "rtsp://${HOST}:8554/unicast" >/dev/null 2>&1 || FRAME_RC=$?
  fi
  agent_debug_log "C" "smoke_test_remote.sh:rtsp" "ffprobe_end" "{\"rc\":$FRAME_RC}" "pre-fix"
  if [ "$FRAME_RC" -eq 0 ]; then
    report "rtsp" "pass" "{\"port_open\":true,\"ffprobe\":\"ok\"}"
  else
    report "rtsp" "fail" "{\"port_open\":true,\"ffprobe\":\"rc=${FRAME_RC}\"}"
  fi
else
  report "rtsp" "pass" "{\"port_open\":true,\"ffprobe\":\"not available on host, skipped\"}"
fi

# --- case: tailscale -----------------------------------------------------------
TS_ENABLE="$(remote "awk -F= '/^TAILSCALE_ENABLE *=/ {print \$2}' /tmp/hack.ini 2>/dev/null" | tr -d '\r')"
if [ "$TS_ENABLE" != "on" ]; then
  report "tailscale" "skip" "{\"enable\":\"$(json_escape "$TS_ENABLE")\"}"
else
  agent_debug_log "D" "smoke_test_remote.sh:tailscale" "tailscale_check_start" "{}" "pre-fix"
  TS_VER="$(remote 'tailscale version 2>&1 | head -1' | tr -d '\r')"
  agent_debug_log "D" "smoke_test_remote.sh:tailscale" "tailscale_check_end" "{\"version\":\"$TS_VER\"}" "pre-fix"
  TS_UP="$(remote 'pgrep -f tailscaled >/dev/null 2>&1 && echo yes || echo no' | tr -d '\r')"
  if [ "$TS_UP" = "yes" ]; then
    report "tailscale" "pass" "{\"version\":\"$(json_escape "$TS_VER")\",\"daemon\":\"running\"}"
  else
    report "tailscale" "fail" "{\"version\":\"$(json_escape "$TS_VER")\",\"daemon\":\"not running\"}"
  fi
fi

# --- case: resources -------------------------------------------------------------
FREE_KB="$(remote 'free | awk "/Mem:/ {print \$4 + \$6}"' | tr -d '\r')"
UPTIME="$(remote 'uptime' | tr -d '\r')"
case "$FREE_KB" in
  ''|*[!0-9]*) FREE_KB=0 ;;
esac
if [ "$FREE_KB" -ge 2048 ]; then
  report "resources" "pass" "{\"free_kb\":${FREE_KB},\"uptime\":\"$(json_escape "$UPTIME")\"}"
else
  report "resources" "fail" "{\"free_kb\":${FREE_KB},\"uptime\":\"$(json_escape "$UPTIME")\"}"
fi

# --- failure: collect debug material ----------------------------------------------
if [ "$FAILED" -ne 0 ]; then
  OUTDIR="$ROOT/sim-results/deploy-$(date +%Y%m%d_%H%M%S)"
  mkdir -p "$OUTDIR"
  remote 'tail -100 /media/mmc/atomhack.log 2>/dev/null || tail -100 /tmp/atomhack.log 2>/dev/null' > "$OUTDIR/atomhack.log.tail" 2>/dev/null || true
  remote 'dmesg | tail -100' > "$OUTDIR/dmesg.tail" 2>/dev/null || true
  remote 'ps' > "$OUTDIR/ps.txt" 2>/dev/null || true
  remote 'cat /tmp/hack.ini 2>/dev/null' > "$OUTDIR/hack.ini" 2>/dev/null || true
  echo "debug material collected: ${OUTDIR}" >&2
  exit 1
fi

exit 0
