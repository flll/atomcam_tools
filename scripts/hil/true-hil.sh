#!/usr/bin/env bash
# True HIL gate: SSH/Tailscale 到達後は deploy-test だけで反復する。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
HOST="${ATOMCAM_HOST:-atomcam33}"
MODE="${1:-deploy-test}"

cd "$ROOT"

case "$MODE" in
  status)
    ./scripts/deploy_remote.sh "$HOST" --status
    ;;
  deploy-test)
    ./scripts/deploy_remote.sh "$HOST" --status || {
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
