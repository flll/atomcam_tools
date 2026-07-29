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
. "$ROOT/scripts/lib/remote.sh"
. "$ROOT/scripts/lib/wait.sh"
. "$ROOT/scripts/lib/ndjson.sh"
HOST="${1:-${ATOMCAM_HOST:-atomcam.local}}"
EXPECTED="${2:-}"
FAILED=0
PASS_N=0; FAIL_N=0; SKIP_N=0
START_TS=$SECONDS

# 実行結果の永続化: ケース別 NDJSON は smoke-<ts>/result.ndjson、
# 1実行=1行のサマリは history.ndjson へ追記(集計は make hil-report)
RUN_TS="$(date +%Y%m%d_%H%M%S)"
RUN_DIR="${SMOKE_RUN_DIR:-$ROOT/sim-results/smoke-${RUN_TS}}"
mkdir -p "$RUN_DIR"
RESULT_FILE="$RUN_DIR/result.ndjson"

finish_history() {
  local result_str="ok"
  [ "$FAILED" -ne 0 ] && result_str="fail"
  hil_history_append "$(printf '{"run":"smoke","timestamp":%s,"host":"%s","pass":%d,"fail":%d,"skip":%d,"elapsed_s":%d,"result":"%s","dir":"%s"}' \
    "$(date +%s)" "$HOST" "$PASS_N" "$FAIL_N" "$SKIP_N" "$((SECONDS - START_TS))" "$result_str" "$(basename "$RUN_DIR")")"
}

# SSH 生死は「変数」ではなくマーカーファイルで持つ。
# 各ケースは $(remote ...) のサブシェル内で ssh を呼ぶため、変数への代入は
# 親シェルに伝わらない(= 実行中に sshd が落ちても検知できなかった)。
# 2026-07-29 の実機で「初回 SSH 成功 → 途中でメモリ枯渇により sshd 応答不能」が発生し、
# preload/tailscale/resources の3ケースが偽陰性になったため、ファイル方式に変更。
SSH_DOWN_FLAG="$RUN_DIR/.ssh_down"
rm -f "$SSH_DOWN_FLAG"

ssh_ok() { [ ! -f "$SSH_DOWN_FLAG" ]; }

remote() {
  # SSH 不通確定後は即 return(各ケースの余計な待ちを防ぐ)
  ssh_ok || return 255
  local rc=0
  remote_ssh "$HOST" "$@" || rc=$?
  # ssh(1) は接続・認証レベルの失敗を 255 で返す。リモートコマンド自身の
  # 非ゼロ終了(grep の 1 等)と区別できるので、255 のときだけ SSH 死と判定する
  if [ "$rc" -eq 255 ]; then
    touch "$SSH_DOWN_FLAG"
  fi
  return "$rc"
}

report() {
  # report CASE RESULT DATA_JSON
  printf '{"case":"%s","result":"%s","host":"%s","timestamp":%s,"data":%s}\n' \
    "$1" "$2" "$HOST" "$(date +%s)" "$3" | tee -a "$RESULT_FILE"
  case "$2" in
    pass) PASS_N=$((PASS_N + 1)) ;;
    fail) FAIL_N=$((FAIL_N + 1)); FAILED=1 ;;
    skip) SKIP_N=$((SKIP_N + 1)) ;;
  esac
}

# --- connectivity precondition -------------------------------------------
# SSH 不通でも即死しない(HTTP フォールバック層):
# 2026-07-24 に「メモリ枯渇で sshd だけ死に、lighttpd(HTTP) は生存」する実機状態を
# 観測済み。SSH 必須ケースは skip し、HTTP で判定できるケースは続行する。
# HTTP まで不通なら完全死なので従来どおり即終了する。
if ! remote 'echo ok' >/dev/null 2>&1; then
  touch "$SSH_DOWN_FLAG"
  report "ssh" "fail" "{\"error\":\"ssh unreachable\",\"hint\":\"HTTP 層のみで継続(sshd だけ死ぬ MEMFREE 枯渇パターンの切り分け)\"}"
  HTTP_FIRST="$(curl -sf -m 10 -o /dev/null -w '%{http_code}' "http://${HOST}/" 2>/dev/null || true)"
  if [ "$HTTP_FIRST" != "200" ]; then
    report "http" "fail" "{\"index_http\":\"$(json_escape "$HTTP_FIRST")\",\"error\":\"http unreachable too (device down?)\"}"
    finish_history
    exit 1
  fi
  report "http" "pass" "{\"index_http\":200,\"note\":\"ssh down but http alive\"}"
fi

# 起動直後は lighttpd / /tmp/hack.ini の生成が ssh より遅れる。
# WebUI 系ケースが誤って fail しないよう、最大 120 秒まで起動完了を待つ。
# (SSH 不通時は上で HTTP 200 を確認済みなので待たない)
if ssh_ok; then
  wait_for_webui "$HOST" 120
fi

# --- case: version ---------------------------------------------------------
VER="$(remote 'cat /etc/atomhack.ver 2>/dev/null' | tr -d '\r' | head -1)"
if ! ssh_ok; then
  report "version" "skip" "{\"reason\":\"ssh down\"}"
elif [ -z "$VER" ]; then
  report "version" "fail" "{\"version\":\"\",\"expected\":\"$(json_escape "$EXPECTED")\"}"
elif [ -n "$EXPECTED" ] && [ "$VER" != "$EXPECTED" ]; then
  report "version" "fail" "{\"version\":\"$(json_escape "$VER")\",\"expected\":\"$(json_escape "$EXPECTED")\"}"
else
  report "version" "pass" "{\"version\":\"$(json_escape "$VER")\",\"expected\":\"$(json_escape "$EXPECTED")\"}"
fi

# --- case: icamera ----------------------------------------------------------
# SSH 不通時は get_jpeg.cgi(iCamera が実フレームを返せるか)で代替判定する。
# get_jpeg「.cgi」が正(拡張子なしは 404 — 2026-07-06 実測)
if ! ssh_ok; then
  JPEG_CODE="$(curl -sf -m 15 -o /dev/null -w '%{http_code}' "http://${HOST}/cgi-bin/get_jpeg.cgi" 2>/dev/null || true)"
  if [ "$JPEG_CODE" = "200" ]; then
    report "icamera" "pass" "{\"method\":\"http_jpeg\",\"http\":200}"
  else
    report "icamera" "fail" "{\"method\":\"http_jpeg\",\"http\":\"$(json_escape "$JPEG_CODE")\"}"
  fi
else
  ICAM_PID="$(remote 'pidof iCamera_app 2>/dev/null' | tr -d '\r')"
  LOG_ERRORS="$(remote 'tail -50 /media/mmc/atomhack.log 2>/dev/null | grep -ciE "error|fail|segfault" || true' | tr -d '\r')"
  if [ -n "$ICAM_PID" ]; then
    report "icamera" "pass" "{\"pid\":\"$(json_escape "$ICAM_PID")\",\"recent_log_errors\":${LOG_ERRORS:-0}}"
  else
    report "icamera" "fail" "{\"pid\":\"\",\"recent_log_errors\":${LOG_ERRORS:-0}}"
  fi
fi

# --- case: preload (libcallback が iCamera_app に注入されているか: F-3 検知) ---
ICAM_PID_P="$(printf '%s' "${ICAM_PID:-}" | awk '{print $1}')"
ATOM_DEBUG="$(remote 'test -f /media/mmc/atom-debug && echo yes || echo no' | tr -d '\r')"
if ! ssh_ok; then
  report "preload" "skip" "{\"reason\":\"ssh down (/proc maps 不可)\"}"
elif [ -z "$ICAM_PID_P" ]; then
  report "preload" "fail" "{\"error\":\"iCamera_app not running\"}"
elif [ "$ATOM_DEBUG" = "yes" ]; then
  report "preload" "skip" "{\"reason\":\"atom-debug marker present\"}"
else
  CB_MAPS="$(remote "grep -c libcallback /proc/${ICAM_PID_P}/maps 2>/dev/null" | tr -d '\r')"
  case "$CB_MAPS" in ''|*[!0-9]*) CB_MAPS=0 ;; esac
  if [ "$CB_MAPS" -gt 0 ]; then
    report "preload" "pass" "{\"maps_entries\":${CB_MAPS}}"
  else
    report "preload" "fail" "{\"maps_entries\":0,\"hint\":\"debug bind 残骸の疑い: scripts/hil/cleanup-debug-boot.sh で確認\"}"
  fi
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
# 有効判定は RTSP_VIDEO0/1/2(hack.ini に "RTSP=" というキーは存在しない — 旧実装は
# 常に空を掴み判定不能だった)。URL は v4l2rtspserver のパス規則に合わせて
# "<device>_unicast"(custompackages の 0002-fixed-rtsp-path.patch で常に device 名が付く)。
# 旧実装の /unicast は実機で 404 Stream Not Found になり恒久 fail していた。
RTSP_V0="$(remote "awk -F= '/^RTSP_VIDEO0 *=/ {print \$2}' /tmp/hack.ini 2>/dev/null" | tr -d '\r')"
RTSP_V1="$(remote "awk -F= '/^RTSP_VIDEO1 *=/ {print \$2}' /tmp/hack.ini 2>/dev/null" | tr -d '\r')"
if [ "$RTSP_V0" = "on" ]; then
  RTSP_PATH="video0_unicast"
elif [ "$RTSP_V1" = "on" ]; then
  RTSP_PATH="video1_unicast"
else
  # SSH 不通で設定が読めない場合も既定パスで直接プローブする
  RTSP_PATH="video0_unicast"
fi
RTSP_ENABLE="$RTSP_V0"
if ! nc -z -w 5 "$HOST" 8554 2>/dev/null; then
  if [ "$RTSP_ENABLE" = "on" ]; then
    report "rtsp" "fail" "{\"port_open\":false,\"rtsp_video0\":\"$(json_escape "$RTSP_V0")\"}"
  else
    report "rtsp" "skip" "{\"port_open\":false,\"rtsp_video0\":\"$(json_escape "$RTSP_V0")\"}"
  fi
elif command -v ffprobe >/dev/null 2>&1; then
  FRAME_RC=0
  agent_debug_log "C" "smoke_test_remote.sh:rtsp" "ffprobe_start" "{\"host\":\"$HOST\",\"path\":\"$RTSP_PATH\"}" "pre-fix"
  if command -v timeout >/dev/null 2>&1; then
    timeout 30 ffprobe -v error -rtsp_transport tcp -select_streams v:0 -show_frames -read_intervals '%+#1' \
      "rtsp://${HOST}:8554/${RTSP_PATH}" >/dev/null 2>&1 || FRAME_RC=$?
  else
    ffprobe -v error -rtsp_transport tcp -select_streams v:0 -show_frames -read_intervals '%+#1' \
      "rtsp://${HOST}:8554/${RTSP_PATH}" >/dev/null 2>&1 || FRAME_RC=$?
  fi
  agent_debug_log "C" "smoke_test_remote.sh:rtsp" "ffprobe_end" "{\"rc\":$FRAME_RC}" "pre-fix"
  if [ "$FRAME_RC" -eq 0 ]; then
    report "rtsp" "pass" "{\"port_open\":true,\"path\":\"$(json_escape "$RTSP_PATH")\",\"ffprobe\":\"ok\"}"
  else
    report "rtsp" "fail" "{\"port_open\":true,\"path\":\"$(json_escape "$RTSP_PATH")\",\"ffprobe\":\"rc=${FRAME_RC}\"}"
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
if ! ssh_ok; then
  # 設定が読めないので直接プローブ: 応答あり=pass、なし=判定不能(無効かもしれない)で skip
  GO2RTC_CODE="$(curl -sf -m 10 -o /dev/null -w '%{http_code}' "http://${HOST}:1984/api/streams" 2>/dev/null)" || GO2RTC_CODE="000"
  if [ "$GO2RTC_CODE" = "200" ]; then
    report "go2rtc" "pass" "{\"api_streams_http\":200,\"note\":\"config unknown (ssh down), probed directly\"}"
  else
    report "go2rtc" "skip" "{\"reason\":\"ssh down and no api answer (disabled or dead: 判定不能)\"}"
  fi
elif [ "$WEBRTC_ENABLE" != "on" ]; then
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
if ! ssh_ok; then
  report "resources" "skip" "{\"reason\":\"ssh down (free/uptime 不可)\"}"
else
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
fi

# --- case: perf (情報記録のみ・常に pass。しきい値はベースライン確定後に導入) ----
if ! ssh_ok; then
  report "perf" "skip" "{\"reason\":\"ssh down\"}"
else
  TL_BOOT="$(remote 'grep -o "\"boot_total\",\"uptime\":[0-9.]*" /tmp/boot_timeline.ndjson 2>/dev/null | tail -1' | tr -d '\r' | grep -o '[0-9.]*$' || true)"
  TL_ICAM="$(remote 'grep -o "\"icamera_ready\",\"uptime\":[0-9.]*" /tmp/boot_timeline.ndjson 2>/dev/null | tail -1' | tr -d '\r' | grep -o '[0-9.]*$' || true)"
  LOAD1="$(remote 'awk "{print \$1}" /proc/loadavg' | tr -d '\r')"
  SD_A="$(remote 'awk "\$3==\"mmcblk0\" {print \$10}" /proc/diskstats' | tr -d '\r')"
  sleep 5
  SD_B="$(remote 'awk "\$3==\"mmcblk0\" {print \$10}" /proc/diskstats' | tr -d '\r')"
  case "$SD_A" in ''|*[!0-9]*) SD_A="" ;; esac
  case "$SD_B" in ''|*[!0-9]*) SD_B="" ;; esac
  SD_W5=""
  [ -n "$SD_A" ] && [ -n "$SD_B" ] && SD_W5=$((SD_B - SD_A))
  report "perf" "pass" "{\"boot_total_sec\":${TL_BOOT:-null},\"icamera_ready_sec\":${TL_ICAM:-null},\"load_1min\":${LOAD1:-null},\"sd_write_sectors_5s\":${SD_W5:-null}}"
fi

# --- failure: collect debug material ----------------------------------------------
if [ "$FAILED" -ne 0 ]; then
  if ssh_ok; then
    remote 'tail -100 /media/mmc/atomhack.log 2>/dev/null || tail -100 /tmp/atomhack.log 2>/dev/null' > "$RUN_DIR/atomhack.log.tail" 2>/dev/null || true
    remote 'dmesg | tail -100' > "$RUN_DIR/dmesg.tail" 2>/dev/null || true
    remote 'ps' > "$RUN_DIR/ps.txt" 2>/dev/null || true
    remote 'cat /tmp/hack.ini 2>/dev/null' > "$RUN_DIR/hack.ini" 2>/dev/null || true
  else
    # SSH 不通: せめて HTTP 側の証拠を残す
    curl -sI -m 10 "http://${HOST}/" > "$RUN_DIR/http-index-headers.txt" 2>&1 || true
    curl -s -m 10 -o /dev/null -w 'get_jpeg.cgi http_code=%{http_code} time_total=%{time_total}\n' \
      "http://${HOST}/cgi-bin/get_jpeg.cgi" > "$RUN_DIR/http-probes.txt" 2>&1 || true
  fi
  echo "debug material collected: ${RUN_DIR}" >&2
  finish_history
  exit 1
fi

finish_history
exit 0
