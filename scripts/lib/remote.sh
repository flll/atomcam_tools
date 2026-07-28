#!/bin/bash
# ホスト側(bash)共通: 実機への ssh/scp ラッパー。
# 呼び出し側は ROOT を定義してから source する(agent-debug-log.sh と同じ流儀)。
# タイムアウトは既定 10s に統一。ホスト候補の高速スキャン用途だけ
# subshell で REMOTE_CONNECT_TIMEOUT=5 に上書きする(旧: 10/5/8 の3系統が散在していた)。
: "${REMOTE_USER:=root}"
: "${REMOTE_CONNECT_TIMEOUT:=10}"

remote_ssh() {
  # remote_ssh HOST CMD...
  local host="$1"; shift
  ssh -o BatchMode=yes -o ConnectTimeout="$REMOTE_CONNECT_TIMEOUT" "${REMOTE_USER}@${host}" "$@"
}

remote_scp() {
  # remote_scp SRC... DST   (-O: 実機側 scp は SFTP 非対応のため必須)
  scp -O -o BatchMode=yes -o ConnectTimeout="$REMOTE_CONNECT_TIMEOUT" "$@"
}

remote_alive() {
  # remote_alive HOST → 0=SSH 到達
  remote_ssh "$1" 'echo ok' >/dev/null 2>&1
}
