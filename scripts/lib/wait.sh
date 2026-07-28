#!/bin/bash
# ホスト側(bash)共通: 実機の起動待ちポーリング。scripts/lib/remote.sh を先に source すること。
# agent_debug_log が定義済み環境では計装ログも残す(未定義でも動く)。

_wait_dbg() { command -v agent_debug_log >/dev/null 2>&1 && agent_debug_log "$@"; return 0; }

wait_for_boot() {
  # wait_for_boot HOST TIMEOUT_S → 0=iCamera_app 起動 / 1=タイムアウト
  # (旧 deploy_remote.sh 内実装の移設。pidof の ssh をログ用と判定用の2回→1回に削減)
  local host="$1" timeout="$2" deadline=$((SECONDS + $2)) ping_deadline=$((SECONDS + 70))
  echo "waiting for reboot (timeout ${timeout}s) ..."
  sleep 15  # let the reboot actually start before probing

  while ((SECONDS < deadline)); do
    local ping_ok=0 icam_pid=""
    if ping -c 1 -W 2 "$host" >/dev/null 2>&1; then ping_ok=1; fi
    if [ "$ping_ok" -eq 1 ]; then
      icam_pid="$(remote_ssh "$host" 'pidof iCamera_app 2>/dev/null' 2>/dev/null | tr -d '\r' || true)"
    fi
    _wait_dbg "A" "lib/wait.sh:wait_for_boot" "boot_probe" "{\"ping_ok\":$ping_ok,\"icam_pid\":\"$icam_pid\",\"elapsed\":$SECONDS}" "lib"
    if [ "$ping_ok" -eq 0 ]; then
      if ((SECONDS > ping_deadline)); then
        echo "still no ping response from ${host} ..."
        ping_deadline=$((SECONDS + 60))
      fi
      sleep 3
      continue
    fi
    if [ -n "$icam_pid" ]; then
      echo "iCamera_app is running"
      return 0
    fi
    sleep 5
  done
  return 1
}

wait_for_icamera() {
  # wait_for_icamera HOST [TRIES=24] [INTERVAL=5] → 0=起動(PID を stdout へ) / 1=タイムアウト
  local host="$1" tries_max="${2:-24}" interval="${3:-5}" tries=0 pid
  while [ "$tries" -lt "$tries_max" ]; do
    pid="$(remote_ssh "$host" 'pidof iCamera_app 2>/dev/null' 2>/dev/null | tr -d '\r' || true)"
    if [ -n "$pid" ]; then
      printf '%s\n' "$pid"
      return 0
    fi
    tries=$((tries + 1))
    sleep "$interval"
  done
  return 1
}

wait_for_webui() {
  # wait_for_webui HOST [MAX_S=120] → 常に 0(ベストエフォート)
  # 起動直後は lighttpd / /tmp/hack.ini の生成が ssh より遅れるため、両方揃うまで待つ
  local host="$1" max_s="${2:-120}" waited=0 http_up ini_up
  while [ "$waited" -lt "$max_s" ]; do
    http_up="$(curl -sf -m 5 -o /dev/null -w '%{http_code}' "http://${host}/" 2>/dev/null || true)"
    ini_up="$(remote_ssh "$host" 'test -s /tmp/hack.ini && echo yes || echo no' 2>/dev/null | tr -d '\r' || true)"
    [ "$http_up" = "200" ] && [ "$ini_up" = "yes" ] && break
    sleep 10
    waited=$((waited + 10))
  done
  return 0
}
