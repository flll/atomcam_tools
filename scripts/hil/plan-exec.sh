#!/bin/bash
# AtomCam plan execution (resilient to reboot/SSH drops)
CAM=root@10.0.0.228
ROOT=/home/lll/atomcam_tools
LOGDIR="$ROOT/sim-results/plan-exec-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$LOGDIR"
LOG="$LOGDIR/run.log"
exec > >(tee -a "$LOG") 2>&1
echo "plan-exec start $(date -Is) log=$LOGDIR"

cam_retry() {
  local n=0 out rc
  while [ "$n" -lt 8 ]; do
    out=$(ssh -o BatchMode=yes -o ConnectTimeout=6 "$CAM" "$@" 2>&1) && { echo "$out"; return 0; }
    n=$((n + 1))
    echo "cam_retry $n failed: $out" | tail -1
    sleep 3
  done
  echo "cam_retry FAIL: $*"
  return 1
}

wait_ssh() {
  for i in $(seq 1 180); do
    if ssh -o BatchMode=yes -o ConnectTimeout=4 "$CAM" true 2>/dev/null; then
      echo "SSH ok attempt $i $(date -Is)"
      return 0
    fi
    sleep 5
  done
  return 1
}

scp_retry() {
  local src=$1 dst=$2 n=0
  while [ "$n" -lt 8 ]; do
    scp -o BatchMode=yes "$src" "$dst" 2>/dev/null && return 0
    n=$((n + 1))
    sleep 3
  done
  return 1
}

if ! wait_ssh; then echo FATAL no_ssh; exit 2; fi

# snapshot (best effort)
{
  cam_retry uptime || true
  cam_retry grep -E 'LD_PRELOAD|iCamera' /media/mmc/atom_init.fixed || true
  cam_retry sh -c 'pidof iCamera_app || echo ICAM=none' || true
} | tee "$LOGDIR/status-before.log"

# critical: restore stable atom_init if LD_PRELOAD present
if cam_retry grep -q LD_PRELOAD /media/mmc/atom_init.fixed 2>/dev/null; then
  echo "restoring stable atom_init from bak-f3test"
  cam_retry sh -c 'cp -f /media/mmc/atom_init.fixed.bak-f3test /media/mmc/atom_init.fixed' || true
fi

# remount + crontab
cam_retry sh -c 'mount -o remount,rw /media/mmc' || true
scp_retry "$ROOT/scripts/hil/debug/crontab" "$CAM:/media/mmc/crontab" && echo crontab_ok || echo crontab_fail
scp_retry "$ROOT/scripts/hil/debug/wifi_audit.sh" "$CAM:/media/mmc/wifi_audit.sh" || true
scp_retry "$ROOT/scripts/hil/debug/tailscale_wrapper.sh" "$CAM:/media/mmc/tailscale_wrapper.sh" || true
cam_retry sh -c 'chmod +x /media/mmc/wifi_audit.sh /media/mmc/tailscale_wrapper.sh; /scripts/set_crontab.sh 2>/dev/null || crontab /media/mmc/crontab' || true

# stabilize now
cam_retry sh -c 'setsid /media/mmc/wdkeep.sh </dev/null >/dev/null 2>&1 &' || true
cam_retry sh -c 'sh /media/mmc/killwebhook.sh' || true
cam_retry sh -c 'sh /media/mmc/wifi_audit.sh' || true

sleep 20
{
  cam_retry uptime || true
  cam_retry sh -c 'pidof iCamera_app || echo ICAM=none' || true
  cam_retry sh -c 'netstat -ln 2>/dev/null | grep :4000 || echo PORT4000=closed' || true
  cam_retry cat /media/mmc/crontab || true
} | tee "$LOGDIR/status-after.log"

# stability check 60s
ok=0
for j in $(seq 1 12); do
  if ssh -o BatchMode=yes -o ConnectTimeout=4 "$CAM" true 2>/dev/null; then ok=$((ok+1)); else ok=0; fi
  sleep 5
done
echo "stable_ssh_checks=$ok/12"
if [ "$ok" -lt 8 ]; then
  echo "WARN: not stable enough for F-3; skipping preload test"
  exit 3
fi

cam_retry sh -c 'dmesg 2>/dev/null | grep -iE segv|page_fault|iCamera | tail -20' | tee "$LOGDIR/dmesg-before.log" || true

echo "running f3-preload-test..."
"$ROOT/scripts/hil/f3-preload-test.sh" 2>&1 | tee "$LOGDIR/f3-preload-test.log" || true

cam_retry sh -c 'dmesg 2>/dev/null | grep -iE segv|page_fault|iCamera | tail -20' | tee "$LOGDIR/dmesg-after.log" || true

if cam_retry sh -c 'pidof iCamera_app' 2>/dev/null; then
  echo "F-3 SUCCESS after test"
else
  echo "F-3 FAILED; LD_DEBUG attempt"
  MODEL=$(cam_retry awk -F '=' '/^PRODUCT_MODEL *=/ {print $2}' /atom/configs/.product_config | tail -1)
  cam_retry sh -c "export PRODUCT_MODEL='$MODEL'; export LD_DEBUG=libs; timeout 10 chroot /atom /tmp/system/bin/atom_init.sh 2>&1 | tail -40" | tee "$LOGDIR/lddebug.log" || true
fi

echo "DONE $(date -Is)"
