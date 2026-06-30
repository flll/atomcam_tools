#!/bin/bash
set -euo pipefail
HOST=10.0.0.228
REPO=/home/lll/atomcam_tools
for i in $(seq 1 24); do
  sleep 15
  if pid=$(ssh -o BatchMode=yes -o ConnectTimeout=5 "root@${HOST}" 'pidof iCamera_app' 2>/dev/null); then
    if [ -n "$pid" ]; then
      echo "camera up after ${i} polls, pid=${pid}"
      break
    fi
  fi
  echo "waiting poll ${i}"
done
cd "$REPO"
./scripts/smoke_test_remote.sh "$HOST"
