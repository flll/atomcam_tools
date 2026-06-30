#!/bin/bash
# Deploy full mmc stabilizer bundle when SSH window opens
CAM=root@10.0.0.228
ROOT=/home/lll/atomcam_tools
DBG="$ROOT/scripts/hil/debug"
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=5"
LOG="$ROOT/sim-results/flash-fix-$(date +%Y%m%d_%H%M%S).log"
exec > >(tee "$LOG") 2>&1
echo "flash-fix $(date -Is)"

push_file() {
  local src=$1 dst=$2
  ssh $SSH_OPTS "$CAM" "cat > $dst" < "$src" && echo "ok $dst" || echo "fail $dst"
}

for i in $(seq 1 120); do
  if ssh $SSH_OPTS "$CAM" true 2>/dev/null; then
    echo "SSH $i ok"
    ssh $SSH_OPTS "$CAM" "
      mount -o remount,rw /media/mmc
      setsid /media/mmc/wdkeep.sh </dev/null >/dev/null 2>&1 &
      sh /media/mmc/killwebhook.sh 2>/dev/null
      uptime
      pidof iCamera_app || echo ICAM=none
    " || true
    push_file "$DBG/wdkeep.sh" /media/mmc/wdkeep.sh
    push_file "$DBG/killwebhook.sh" /media/mmc/killwebhook.sh
    push_file "$DBG/atom_init.fixed" /media/mmc/atom_init.fixed
    push_file "$DBG/S61atomcam.fixed" /media/mmc/S61atomcam.fixed
    push_file "$DBG/crontab" /media/mmc/crontab
    push_file "$DBG/wifi_audit.sh" /media/mmc/wifi_audit.sh
    push_file "$DBG/tailscale_wrapper.sh" /media/mmc/tailscale_wrapper.sh
    ssh $SSH_OPTS "$CAM" "
      chmod +x /media/mmc/wdkeep.sh /media/mmc/killwebhook.sh /media/mmc/atom_init.fixed /media/mmc/S61atomcam.fixed
      chmod +x /media/mmc/wifi_audit.sh /media/mmc/tailscale_wrapper.sh
      /scripts/set_crontab.sh 2>/dev/null || crontab /media/mmc/crontab
      setsid /media/mmc/wdkeep.sh </dev/null >/dev/null 2>&1 &
      sh /media/mmc/killwebhook.sh
      sh /media/mmc/wifi_audit.sh 2>/dev/null
      uptime
      pidof iCamera_app || echo ICAM=none
      grep iCamera /media/mmc/atom_init.fixed | tail -1
    " && break
  fi
  sleep 5
done
echo DONE
