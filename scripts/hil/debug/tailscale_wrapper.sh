#!/bin/sh
# Tailscale bring-up for ATOMCam (kernel 3.10.14, userspace-networking).
# TAILSCALE_ENABLE=off in hack.ini disables squashfs /scripts/tailscale.sh (S80);
# this wrapper is the sole bring-up path via mmc crontab.
# busybox on ATOMCam has no flock — use mkdir for mutual exclusion.
LOCKDIR=/var/run/tailscale_wrapper.lock.d
if ! mkdir "$LOCKDIR" 2>/dev/null; then exit 0; fi
trap 'rmdir "$LOCKDIR" 2>/dev/null' EXIT INT TERM

mkdir -p /tmp/fakebin
cat > /tmp/fakebin/uname <<'EOF'
#!/bin/sh
case "$1" in
  -r) echo "3.10.14"; exit 0 ;;
  -a) echo "Linux atomcam 3.10.14 mips"; exit 0 ;;
esac
exec busybox uname "$@"
EOF
chmod +x /tmp/fakebin/uname

STATE=/tmp/tailscale/tailscaled.state
BAK=/media/mmc/tailscaled.state
SOCK=/var/run/tailscale/tailscaled.sock
LOG=/tmp/tsd.log
INI=/media/mmc/hack.ini
mkdir -p /tmp/tailscale /var/run/tailscale

if ! ip route 2>/dev/null | grep -q '^default'; then
  exit 0
fi

read_ini() {
  awk -F= -v k="$1" '
    $1 ~ ("^[ \t]*" k "[ \t]*$") {
      v=$2; gsub(/^[ \t]+|[ \t\r]+$/, "", v); print v; exit
    }
  ' "$INI" 2>/dev/null
}

KEY=$(read_ini TAILSCALE_AUTH_KEY)
HOST=$(read_ini TAILSCALE_HOSTNAME)
TAGS=$(read_ini TAILSCALE_TAGS)
[ -z "$HOST" ] && HOST=atomcam33
[ -z "$TAGS" ] && TAGS=tag:server
if [ -z "$KEY" ]; then
  echo "$(date -Is) tailscale_wrapper: missing TAILSCALE_AUTH_KEY" >>"$LOG"
  exit 1
fi

if pidof tailscaled >/dev/null 2>&1 && [ ! -S "$SOCK" ]; then
  killall tailscaled 2>/dev/null
  sleep 2
  rm -f "$SOCK" /var/run/tailscaled.pid
fi

if [ -f "$BAK" ]; then
  if [ ! -f "$STATE" ] || [ ! -s "$STATE" ] || [ "$(wc -c <"$STATE" 2>/dev/null || echo 0)" -lt 64 ]; then
    cp "$BAK" "$STATE"
  fi
fi

if pidof tailscaled >/dev/null 2>&1 && [ -S "$SOCK" ]; then
  OUT=$(PATH=/tmp/fakebin:$PATH busybox timeout 12 /usr/bin/tailscale status 2>&1) || OUT="failed to connect"
  if ! echo "$OUT" | grep -qiE 'Logged out|NeedsLogin|failed to connect|stopped|Terminated|no such file'; then
    [ -f "$STATE" ] && cp "$STATE" "$BAK" 2>/dev/null; sync
    exit 0
  fi
  killall tailscaled 2>/dev/null
  sleep 2
  rm -f "$SOCK" /var/run/tailscaled.pid
fi

if ! pidof tailscaled >/dev/null 2>&1; then
  rm -f /var/run/tailscaled.pid "$SOCK" 2>/dev/null
  PATH=/tmp/fakebin:$PATH setsid /usr/sbin/tailscaled \
    --state="$STATE" --socket="$SOCK" --port=41641 --tun=userspace-networking \
    </dev/null >>"$LOG" 2>&1 &
  i=0
  while [ "$i" -lt 30 ]; do
    [ -S "$SOCK" ] && break
    i=$((i + 1))
    sleep 2
  done
  if [ ! -S "$SOCK" ]; then
    echo "$(date -Is) tailscale_wrapper: socket not ready after 60s" >>"$LOG"
    exit 1
  fi
fi

PATH=/tmp/fakebin:$PATH busybox timeout 420 /usr/bin/tailscale up \
  --auth-key="$KEY" --hostname="$HOST" --advertise-tags="$TAGS" --ssh --timeout=180s \
  >>"$LOG" 2>&1 || echo "$(date -Is) tailscale up failed rc=$?" >>"$LOG"

[ -f "$STATE" ] && [ "$(wc -c <"$STATE" 2>/dev/null || echo 0)" -ge 64 ] && cp "$STATE" "$BAK" 2>/dev/null
sync
