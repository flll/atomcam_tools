#!/usr/bin/env bash
# Debug + fix iteration harness for atomcam_tools (LAN / optional tailnet).
#
# usage:
#   ./scripts/hil/debug-hil-loop.sh resolve     # pick ATOMCAM_HOST (tailnet then LAN)
#   ./scripts/hil/debug-hil-loop.sh probe       # runtime snapshot + logs → sim-results/
#   ./scripts/hil/debug-hil-loop.sh recover     # start iCamera without LD_PRELOAD (no reboot)
#   ./scripts/hil/debug-hil-loop.sh status      # deploy_remote --status
#   ./scripts/hil/debug-hil-loop.sh deploy-test # preflight → make deploy-test
#   ./scripts/hil/debug-hil-loop.sh loop        # probe → recover if needed → deploy-test
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
cd "$ROOT"
. "$ROOT/scripts/hil/agent-debug-log.sh"

MODE="${1:-probe}"
HOST="${ATOMCAM_HOST:-}"
OUT="${DEBUG_HIL_OUT:-}"
CANDIDATES=()

if [ -n "$HOST" ]; then
  CANDIDATES+=("$HOST")
else
  CANDIDATES+=(atomcam33 10.0.0.228 atomcam.local)
fi

remote() {
  ssh -o BatchMode=yes -o ConnectTimeout=10 "root@${HOST}" "$@"
}

resolve_host() {
  local h
  for h in "$@"; do
  [ -z "$h" ] && continue
    if ssh -o BatchMode=yes -o ConnectTimeout=5 "root@${h}" 'echo ok' >/dev/null 2>&1; then
      HOST="$h"
      agent_debug_log "R" "debug-hil-loop.sh:resolve" "host_ok" "{\"host\":\"$HOST\"}" "harness"
      echo "$HOST"
      return 0
    fi
  done
  agent_debug_log "R" "debug-hil-loop.sh:resolve" "host_fail" "{\"candidates\":\"$*\"}" "harness"
  return 1
}

ensure_outdir() {
  if [ -z "$OUT" ]; then
    OUT="$ROOT/sim-results/debug-hil-$(date +%Y%m%d_%H%M%S)"
  fi
  mkdir -p "$OUT"
}

probe_device() {
  ensure_outdir
  agent_debug_log "P" "debug-hil-loop.sh:probe" "start" "{\"host\":\"$HOST\",\"out\":\"$OUT\"}" "harness"
  {
    echo "host=$HOST"
    echo "ts=$(date -Is)"
    remote 'hostname; uptime; ip -4 addr show wlan0 2>/dev/null | grep inet; pidof iCamera_app 2>/dev/null || echo no-icamera; ls /media/mmc/atom-debug 2>/dev/null || echo no-atom-debug; mount | grep -E "S61atomcam|atom_init" || true; grep -E "LD_PRELOAD|warning skip|iCamera_app" /etc/init.d/S61atomcam /atom_patch/system_bin/atom_init.sh 2>/dev/null | head -6'
    remote '/scripts/cmd audio 2>&1 | head -1' || true
    remote 'tailscale status 2>&1 | head -3' || true
  } | tee "$OUT/probe.txt"

  remote 'tail -80 /media/mmc/atomhack.log 2>/dev/null' >"$OUT/atomhack.tail" 2>/dev/null || true
  remote 'tail -80 /media/mmc/tools.log 2>/dev/null' >"$OUT/tools.tail" 2>/dev/null || true
  remote 'dmesg | tail -40' >"$OUT/dmesg.tail" 2>/dev/null || true
  remote 'ps' >"$OUT/ps.txt" 2>/dev/null || true
  echo "probe_out=$OUT"
}

recover_icamera() {
  agent_debug_log "F" "debug-hil-loop.sh:recover" "start" "{\"host\":\"$HOST\"}" "harness"
  remote 'rm -f /media/mmc/atom-debug; mount -o bind /media/mmc/atom_init.fixed /atom_patch/system_bin/atom_init.sh 2>/dev/null || true; mount -o bind /media/mmc/S61atomcam.fixed /etc/init.d/S61atomcam 2>/dev/null || true; pidof iCamera_app >/dev/null 2>&1 && exit 0; chroot /atom sh -c "export PATH=/tmp/system/bin:/system/bin:/bin:/sbin; export LD_LIBRARY_PATH=/thirdlib:/system/lib:/tmp:/tmp/system/lib/modules/; /system/bin/iCamera_app >> /media/mmc/tools.log 2>> /media/mmc/tools.log &"; sleep 5; pidof iCamera_app || echo no-icamera'
}

run_status() {
  ATOMCAM_HOST="$HOST" ./scripts/deploy_remote.sh "$HOST" --status
}

run_deploy_test() {
  ./scripts/hil/true-hil.sh deploy-test
}

case "$MODE" in
  resolve)
    resolve_host "${CANDIDATES[@]}" || exit 20
    ;;
  probe)
    resolve_host "${CANDIDATES[@]}" || exit 20
    probe_device
    ;;
  recover)
    resolve_host "${CANDIDATES[@]}" || exit 20
    recover_icamera
    ;;
  status)
    resolve_host "${CANDIDATES[@]}" || exit 20
    export ATOMCAM_HOST="$HOST"
    run_status
    ;;
  deploy-test)
    resolve_host "${CANDIDATES[@]}" || exit 20
    export ATOMCAM_HOST="$HOST"
    run_deploy_test
    ;;
  loop)
    resolve_host "${CANDIDATES[@]}" || exit 20
    export ATOMCAM_HOST="$HOST"
    probe_device
    if ! remote 'pidof iCamera_app >/dev/null 2>&1' 2>/dev/null; then
      recover_icamera
      sleep 30
    fi
    run_deploy_test
    ;;
  *)
    echo "usage: $0 [resolve|probe|recover|status|deploy-test|loop]" >&2
    exit 1
    ;;
esac
