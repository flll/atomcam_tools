#!/bin/bash
# F-3 validate-live: deploy full libcallback + LD_PRELOAD atom_init, sustain 60s+, check port4000/audio/HTTP.
# Does NOT restore stable atom_init on exit (leaves preload config for user Web UI check).
set -euo pipefail
CAM=root@10.0.0.228
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=12"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SO="$ROOT/libcallback/libcallback.f3-full.so"
TEMPLATE="$ROOT/scripts/hil/atom_init.preload.fixed"
WAIT="${F3_VALIDATE_WAIT:-65}"
RUN="$ROOT/sim-results/f3-validate-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RUN"
exec > >(tee "$RUN/validate.log") 2>&1

cam() { ssh $SSH_OPTS "$CAM" "$@"; }

echo "f3-validate-live $(date -Is) run=$RUN wait=${WAIT}s"

bash "$ROOT/scripts/hil/flash-fix.sh" 2>&1 | tail -5
bash "$ROOT/scripts/hil/build_libcallback_tier.sh" full 2>&1 | tail -3
[ -f "$SO" ] || { echo "FATAL: missing $SO"; exit 2; }
LOCAL_MD5=$(md5sum "$SO" | awk '{print $1}')

cam "mount -o remount,rw /media/mmc 2>/dev/null || true"
ssh $SSH_OPTS "$CAM" "cat > /media/mmc/libcallback.so" < "$SO"
MD5=$(cam "md5sum /media/mmc/libcallback.so" | awk '{print $1}')
[ "$MD5" = "$LOCAL_MD5" ] || { echo "FATAL: md5 mismatch"; exit 2; }
echo "libcallback_md5=$MD5"

MODEL=$(cam "awk -F '=' '/^PRODUCT_MODEL *=/ {print \$2}' /atom/configs/.product_config")
cam "pgrep -f /media/mmc/wdkeep.sh >/dev/null || setsid /media/mmc/wdkeep.sh </dev/null >/dev/null 2>&1 &"
cam "sh /media/mmc/killwebhook.sh 2>/dev/null || true"

sed "s/^export PRODUCT_MODEL=.*/export PRODUCT_MODEL=$MODEL/" "$TEMPLATE" | \
  ssh $SSH_OPTS "$CAM" "cat > /media/mmc/atom_init.fixed && chmod +x /media/mmc/atom_init.fixed"

cam "killall -9 iCamera_app 2>/dev/null; sleep 2"
cam "export PRODUCT_MODEL='$MODEL'; chroot /atom /tmp/system/bin/atom_init.sh >/tmp/f3-validate-init.log 2>&1 &"
echo "waiting ${WAIT}s for sustained preload run..."
sleep "$WAIT"

RESULT=$(cam "sh -s" <<'REMOTE'
ICAM=$(pidof iCamera_app || echo CRASHED)
PORT=$(netstat -ln 2>/dev/null | grep ":4000 " || echo none)
AUDIO=$(/scripts/cmd audio 2>/dev/null || echo cmd_fail)
HTTP=$(wget -q -O /dev/null -S http://127.0.0.1/ 2>&1 | head -1 || echo wget_fail)
TRACE=$(wc -l </tmp/libcb-trace.log 2>/dev/null || echo 0)
UPTIME=$(uptime)
echo "ICAM=$ICAM"
echo "PORT=$PORT"
echo "AUDIO=$AUDIO"
echo "HTTP=$HTTP"
echo "TRACE_LINES=$TRACE"
echo "UPTIME=$UPTIME"
REMOTE
)
echo "$RESULT"

ICAM=$(echo "$RESULT" | awk -F= '/^ICAM=/{print $2}')
PORT=$(echo "$RESULT" | awk -F= '/^PORT=/{print $2}')
AUDIO=$(echo "$RESULT" | awk -F= '/^AUDIO=/{print $2}')
HTTP=$(echo "$RESULT" | awk -F= '/^HTTP=/{print $2}')

python3 - <<PY
import json
d={
  "icam": "$ICAM",
  "port4000": "open" if ":4000" in """$PORT""" else "closed",
  "audio": """$AUDIO""",
  "http": """$HTTP""",
  "md5": "$MD5",
  "wait_s": $WAIT,
}
open("$RUN/result.json","w").write(json.dumps(d, ensure_ascii=False, indent=2))
print(json.dumps(d, ensure_ascii=False))
PY

echo "$RESULT" > "$RUN/result.txt"
cam "tail -20 /tmp/f3-validate-init.log" > "$RUN/atom-init.log" 2>/dev/null || true

OK=0
[ "$ICAM" != "CRASHED" ] && OK=1
echo "$PORT" | grep -q ':4000' && OK=$((OK+1))
echo "$AUDIO" | grep -qE '^(on|off)$' && OK=$((OK+1))
echo "$HTTP" | grep -qi '200' && OK=$((OK+1))

if [ "$OK" -ge 3 ]; then
  echo "VALIDATE_LIVE: PASS ($OK/4 checks; Web UI live = user visual)"
  exit 0
fi
echo "VALIDATE_LIVE: FAIL ($OK/4 checks)"
exit 1
