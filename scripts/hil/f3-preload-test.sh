#!/bin/bash
# F-3 LD_PRELOAD trial ??boot stays stable; this script swaps atom_init only for the test.
set -euo pipefail
CAM=root@10.0.0.228
ROOT=/home/lll/atomcam_tools
SRC=$ROOT/libcallback/libcallback.f3-trace.so
TEMPLATE=$ROOT/scripts/hil/atom_init.f3test.fixed

cam() { ssh -o BatchMode=yes -o ConnectTimeout=15 "$CAM" "$@"; }

restore_stable() {
  cam "test -f /media/mmc/atom_init.fixed.bak-f3test && cp -f /media/mmc/atom_init.fixed.bak-f3test /media/mmc/atom_init.fixed" 2>/dev/null || true
  echo "restored stable atom_init.fixed"
}
trap restore_stable EXIT

for i in $(seq 1 30); do
  if cam "test -d /media/mmc" 2>/dev/null; then break; fi
  echo "wait mmc $i"; sleep 5
done
cam "test -d /media/mmc" || { echo "FATAL: /media/mmc missing"; exit 2; }

MODEL=$(cam "awk -F '=' '/^PRODUCT_MODEL *=/ {print \$2}' /atom/configs/.product_config")
echo "PRODUCT_MODEL=$MODEL"

scp -o BatchMode=yes -o ConnectTimeout=8 "$SRC" "$CAM:/media/mmc/libcallback.so"
cam "md5sum /media/mmc/libcallback.so"

cam "pgrep -f /media/mmc/wdkeep.sh >/dev/null 2>&1 || setsid /media/mmc/wdkeep.sh </dev/null >/dev/null 2>&1 &"
cam "sh /media/mmc/killwebhook.sh 2>/dev/null || true"
cam "cp -f /media/mmc/atom_init.fixed /media/mmc/atom_init.fixed.bak-f3test"

sed "s/^export PRODUCT_MODEL=.*/export PRODUCT_MODEL=$MODEL/" "$TEMPLATE" | \
  ssh -o BatchMode=yes "$CAM" "cat > /media/mmc/atom_init.fixed && chmod +x /media/mmc/atom_init.fixed"

cam ": > /media/mmc/libcb-trace.log; : > /tmp/libcb-trace.log; : > /tmp/f3-test.log"
cam "export PRODUCT_MODEL='$MODEL'; /etc/init.d/S61atomcam restart >/tmp/f3-s61.log 2>&1" || true
sleep 25

cam 'echo ICAM=$(pidof iCamera_app || echo CRASHED); echo PORT=$(netstat -ln 2>/dev/null | grep ":4000 " || echo none); /scripts/cmd audio 2>/dev/null || echo cmd_fail; echo TRACE_MMC:; cat /media/mmc/libcb-trace.log 2>/dev/null || echo empty; echo TRACE_TMP:; cat /tmp/libcb-trace.log 2>/dev/null || echo empty; echo LOG:; tail -40 /tmp/f3-s61.log 2>/dev/null; dmesg 2>/dev/null | grep -i segv | tail -5 || true'

# trap EXIT restores stable atom_init.fixed

