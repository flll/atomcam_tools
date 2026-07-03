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

# 起動直後は lighttpd / /tmp/hack.ini の生成が ssh より遅れる。
# WebUI 系ケースが誤って fail しないよう、最大 120 秒まで起動完了を待つ。
BOOT_WAIT=0
while [ "$BOOT_WAIT" -lt 120 ]; do
  HTTP_UP="$(curl -sf -m 5 -o /dev/null -w '%{http_code}' "http://${HOST}/" 2>/dev/null || true)"
  INI_UP="$(remote 'test -s /tmp/hack.ini && echo yes || echo no' 2>/dev/null | tr -d '\r')"
  [ "$HTTP_UP" = "200" ] && [ "$INI_UP" = "yes" ] && break
  sleep 10
  BOOT_WAIT=$((BOOT_WAIT + 10))
done

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

# --- case: webui-spa (web-new index + gzip assets) ---------------------------
SPA_INDEX_RC=0
SPA_INDEX_CT="$(curl -sf -m 10 -o /dev/null -w '%{http_code}' "http://${HOST}/" 2>/dev/null)" || SPA_INDEX_RC=$?
SPA_HAS_VITE=0
SPA_BODY=""
if [ "$SPA_INDEX_RC" -eq 0 ] && [ "$SPA_INDEX_CT" = "200" ]; then
  SPA_BODY="$(curl -sf -m 10 "http://${HOST}/" 2>/dev/null | head -20)" || true
  echo "$SPA_BODY" | grep -q '/assets/' && SPA_HAS_VITE=1
fi
ASSET_GZ_RC=0
ASSET_PATH="$(echo "$SPA_BODY" | grep -oE '/assets/[^"'"'"']+\.js' | head -1)"
if [ -n "$ASSET_PATH" ]; then
  ASSET_GZ_CT="$(curl -sf -m 10 -o /dev/null -w '%{http_code}' "http://${HOST}${ASSET_PATH}" 2>/dev/null)" || ASSET_GZ_RC=$?
else
  ASSET_GZ_CT="000"
fi
if [ "$SPA_INDEX_RC" -eq 0 ] && [ "$SPA_INDEX_CT" = "200" ] && [ "$SPA_HAS_VITE" -eq 1 ] && [ "$ASSET_GZ_RC" -eq 0 ] && [ "$ASSET_GZ_CT" = "200" ]; then
  report "webui_spa" "pass" "{\"index_http\":200,\"asset\":\"$(json_escape "$ASSET_PATH")\",\"asset_http\":200}"
elif [ "$SPA_INDEX_RC" -eq 0 ] && [ "$SPA_INDEX_CT" = "200" ] && echo "$SPA_BODY" | grep -q 'bundle_'; then
  report "webui_spa" "skip" "{\"reason\":\"legacy vue bundle UI\"}"
else
  report "webui_spa" "fail" "{\"index_http\":\"$(json_escape "$SPA_INDEX_CT")\",\"has_vite\":${SPA_HAS_VITE},\"asset\":\"$(json_escape "$ASSET_PATH")\",\"asset_http\":\"$(json_escape "$ASSET_GZ_CT")\"}"
fi

# --- case: webui_css (CSS 404 再発防止: index が参照する CSS が正しく配信されるか) ---
CSS_PATH="$(curl -sf -m 10 "http://${HOST}/" 2>/dev/null | grep -oE '(\./)?assets/[^"'"'"']+\.css(\.gz)?' | head -1 | sed 's|^\./||')"
if [ -z "$CSS_PATH" ]; then
  report "webui_css" "fail" "{\"error\":\"no stylesheet reference in index\"}"
else
  CSS_HEAD="$(curl -sfI -m 10 "http://${HOST}/${CSS_PATH}" 2>/dev/null)" || true
  CSS_CODE="$(printf '%s' "$CSS_HEAD" | awk 'NR==1{print $2}')"
  CSS_TYPE="$(printf '%s' "$CSS_HEAD" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2}')"
  if [ "$CSS_CODE" = "200" ] && printf '%s' "$CSS_TYPE" | grep -qi 'text/css'; then
    report "webui_css" "pass" "{\"css\":\"$(json_escape "$CSS_PATH")\",\"http\":200,\"content_type\":\"$(json_escape "$CSS_TYPE")\"}"
  else
    report "webui_css" "fail" "{\"css\":\"$(json_escape "$CSS_PATH")\",\"http\":\"$(json_escape "$CSS_CODE")\",\"content_type\":\"$(json_escape "$CSS_TYPE")\"}"
  fi
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

# --- case: go2rtc (WebRTC 有効時のみ :1984 API の応答を確認) -------------------
WEBRTC_ENABLE="$(remote "awk -F= '/^WEBRTC_ENABLE *=/ {print \$2}' /tmp/hack.ini 2>/dev/null" | tr -d '\r')"
if [ "$WEBRTC_ENABLE" != "on" ]; then
  report "go2rtc" "skip" "{\"webrtc_enable\":\"$(json_escape "$WEBRTC_ENABLE")\"}"
else
  GO2RTC_CODE="$(curl -sf -m 10 -o /dev/null -w '%{http_code}' "http://${HOST}:1984/api/streams" 2>/dev/null)" || GO2RTC_CODE="000"
  if [ "$GO2RTC_CODE" = "200" ]; then
    report "go2rtc" "pass" "{\"api_streams_http\":200}"
  else
    report "go2rtc" "fail" "{\"api_streams_http\":\"$(json_escape "$GO2RTC_CODE")\"}"
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
