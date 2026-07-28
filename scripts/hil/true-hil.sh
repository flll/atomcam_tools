#!/usr/bin/env bash
# True HIL gate: SSH/Tailscale 到達後は deploy-test だけで反復する。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
HOST="${ATOMCAM_HOST:-atomcam33}"
MODE="${1:-deploy-test}"

cd "$ROOT"
. "$ROOT/scripts/hil/agent-debug-log.sh"
. "$ROOT/scripts/lib/remote.sh"
. "$ROOT/scripts/lib/wait.sh"

wait_icamera_preflight() {
  local host="$1" pid
  remote_ssh "$host" 'rm -f /media/mmc/atom-debug' 2>/dev/null || true
  if pid="$(wait_for_icamera "$host" 24 5)"; then
    agent_debug_log "B" "true-hil.sh:wait_icamera_preflight" "icamera_up" "{\"pid\":\"$pid\"}" "post-fix"
    return 0
  fi
  agent_debug_log "B" "true-hil.sh:wait_icamera_preflight" "icamera_timeout" "{}" "post-fix"
  return 1
}

case "$MODE" in
  status)
    ./scripts/deploy_remote.sh "$HOST" --status
    ;;
  deploy-test)
    agent_debug_log "E" "true-hil.sh:deploy-test" "preflight_start"
    # 旧: `|| true "{...}" "pre-fix"` — 引数が true コマンドに食われてログされない既存バグを修正
    wait_icamera_preflight "$HOST" || \
      agent_debug_log "E" "true-hil.sh:deploy-test" "preflight_timeout" "{\"host\":\"$HOST\"}" "pre-fix"
    ./scripts/deploy_remote.sh "$HOST" --status || {
      agent_debug_log "B" "true-hil.sh:deploy-test" "status_gate_failed" "{\"host\":\"$HOST\"}" "pre-fix"
      echo "true-hil: SSH unreachable at $HOST — bootstrap フェーズへ (SD 抜きは例外パス)" >&2
      exit 20
    }
    make deploy-test ATOMCAM_HOST="$HOST"
    ;;
  *)
    echo "usage: $0 [status|deploy-test]" >&2
    exit 1
    ;;
esac
