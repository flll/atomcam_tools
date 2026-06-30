#!/bin/bash
# F-3 test via atom_init.f3icamera-only.fixed (no insmod), trap restores stable atom_init.
# Usage: f3-chroot-test.sh <path-to-libcallback.so> [logdir]
set -euo pipefail
CAM=root@10.0.0.228
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=12"
SO_RAW="${1:?usage: f3-chroot-test.sh path/to/libcallback.so [logdir]}"
LOGDIR="${2:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEMPLATE="${F3_ATOM_INIT_TEMPLATE:-$ROOT/scripts/hil/atom_init.f3icamera-only.fixed}"

if [[ "$SO_RAW" != /* ]]; then
  SO="$ROOT/$SO_RAW"
else
  SO="$SO_RAW"
fi
[ -f "$SO" ] || { echo "FATAL: missing $SO"; exit 2; }
LOCAL_MD5=$(md5sum "$SO" | awk '{print $1}')

cam() { ssh $SSH_OPTS "$CAM" "$@"; }

restore_stable() {
  cam "test -f /media/mmc/atom_init.fixed.bak-f3test && cp -f /media/mmc/atom_init.fixed.bak-f3test /media/mmc/atom_init.fixed" 2>/dev/null || true
  cam "killall -9 iCamera_app 2>/dev/null; sleep 1; chroot /atom /tmp/system/bin/atom_init.sh >/dev/null 2>&1 &" 2>/dev/null || true
  echo "restored stable atom_init.fixed"
}
trap restore_stable EXIT

if [ -n "$LOGDIR" ]; then
  mkdir -p "$LOGDIR"
  exec > >(tee -a "$LOGDIR/chroot-test.log") 2>&1
fi

for i in $(seq 1 30); do
  cam true 2>/dev/null && break
  sleep 3
done
cam true || { echo "FATAL: camera SSH unavailable"; exit 2; }

MODEL=$(cam "awk -F '=' '/^PRODUCT_MODEL *=/ {print \$2}' /atom/configs/.product_config")
echo "PRODUCT_MODEL=$MODEL"
echo "local_md5=$LOCAL_MD5 so=$SO"

cam "mount -o remount,rw /media/mmc 2>/dev/null || true"
ssh $SSH_OPTS "$CAM" "cat > /media/mmc/libcallback.so" < "$SO"
MD5=$(cam "md5sum /media/mmc/libcallback.so" | awk '{print $1}')
echo "remote_md5=$MD5"
if [ "$MD5" != "$LOCAL_MD5" ]; then
  echo "FATAL: upload md5 mismatch local=$LOCAL_MD5 remote=$MD5"
  exit 2
fi

cam "pgrep -f /media/mmc/wdkeep.sh >/dev/null || setsid /media/mmc/wdkeep.sh </dev/null >/dev/null 2>&1 &"
cam "sh /media/mmc/killwebhook.sh 2>/dev/null || true"
cam ": > /media/mmc/libcb-trace.log; : > /tmp/libcb-trace.log"

cam "cp -f /media/mmc/atom_init.fixed /media/mmc/atom_init.fixed.bak-f3test"
sed "s/^export PRODUCT_MODEL=.*/export PRODUCT_MODEL=$MODEL/" "$TEMPLATE" | \
  ssh $SSH_OPTS "$CAM" "cat > /media/mmc/atom_init.fixed && chmod +x /media/mmc/atom_init.fixed"

OLD_PID=$(cam "pidof iCamera_app" 2>/dev/null || true)
echo "old_pid=${OLD_PID:-none}"

cam "killall -9 iCamera_app 2>/dev/null; sleep 2"
cam "export PRODUCT_MODEL='$MODEL'; chroot /atom /tmp/system/bin/atom_init.sh >/tmp/f3-atom-init.log 2>&1 &"
sleep 50

RESULT=$(cam "OLD_PID='${OLD_PID}' sh -s" <<'REMOTE'
NEW_PID=$(pidof iCamera_app || echo CRASHED)
if [ "$NEW_PID" = CRASHED ] || [ -z "$NEW_PID" ]; then ICAM=CRASHED
elif [ -n "$OLD_PID" ] && [ "$OLD_PID" = "$NEW_PID" ]; then ICAM=CRASHED
else ICAM=$NEW_PID; fi
PORT=$(netstat -ln 2>/dev/null | grep ":4000 " || echo none)
AUDIO=$(/scripts/cmd audio 2>/dev/null || echo cmd_fail)
TRACE=$(wc -l </tmp/libcb-trace.log 2>/dev/null || echo 0)
SEG=$(dmesg 2>/dev/null | grep -iE "segv|page_fault.*iCamera" | tail -3 | tr "\n" " ")
echo "new_pid=$NEW_PID"
echo "ICAM=$ICAM"
echo "PORT=$PORT"
echo "AUDIO=$AUDIO"
echo "TRACE_LINES=$TRACE"
echo "DMESG=$SEG"
REMOTE
)
echo "$RESULT"

ICAM=$(echo "$RESULT" | awk -F= '/^ICAM=/{print $2}')
PORT=$(echo "$RESULT" | awk -F= '/^PORT=/{print $2}')
TRACE=$(echo "$RESULT" | awk -F= '/^TRACE_LINES=/{print $2}')
SO_REL="${SO#$ROOT/}"

if [ -n "$LOGDIR" ]; then
  echo "$RESULT" > "$LOGDIR/result.txt"
  cam "tail -30 /tmp/f3-atom-init.log 2>/dev/null" > "$LOGDIR/atom-init.log" || true
  cam "dmesg 2>/dev/null | tail -20" > "$LOGDIR/dmesg.tail" || true
  cam "cat /tmp/libcb-trace.log 2>/dev/null" > "$LOGDIR/trace.log" || true
fi

python3 - <<PY
import json
d={
  "icam": "$ICAM",
  "port4000": "open" if ":4000" in """$PORT""" else "closed",
  "trace_lines": int("""${TRACE:-0}"""),
  "md5": "$MD5",
  "so": "$SO_REL",
}
print(json.dumps(d, ensure_ascii=False))
PY

if [ "$ICAM" = "CRASHED" ]; then exit 1; fi
exit 0
