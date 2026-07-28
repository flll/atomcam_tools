#!/bin/bash
# 実機の起動を待ってから smoke を1回流すユーティリティ(lll-legacy ローカル用)。
set -euo pipefail
HOST=10.0.0.228
REPO=/home/lll/atomcam_tools
ROOT="$REPO"
. "$ROOT/scripts/lib/remote.sh"
. "$ROOT/scripts/lib/wait.sh"

sleep 15
if pid=$(REMOTE_CONNECT_TIMEOUT=5 wait_for_icamera "$HOST" 24 15); then
  echo "camera up, pid=${pid}"
else
  echo "camera not up after polls (smoke は続行して失敗収集に任せる)"
fi
cd "$REPO"
./scripts/smoke_test_remote.sh "$HOST"
