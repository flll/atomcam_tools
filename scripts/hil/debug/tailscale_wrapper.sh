#!/bin/sh
# Tailscale bring-up for ATOMCam (kernel 3.10.14, no /dev/net/tun -> userspace-networking).
# - Persists tailscaled state across reboots: keeps state in fast /tmp, backs it up to
#   /media/mmc and restores it on boot, so the node keeps ONE identity / stable IP
#   (avoids duplicate atomcam33-N nodes and changing 100.x IPs).
# - Idempotent: when already logged in, it only refreshes the backup and exits, so the
#   per-minute cron does not churn the backend (no repeated --reset).
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
mkdir -p /tmp/tailscale /var/run/tailscale

# skip churn when WAN route missing (wifi_audit repairs route first)
if ! ip route 2>/dev/null | grep -q '^default'; then
  exit 0
fi

# restore persisted identity on boot (also recover corrupt/tiny state files)
if [ -f "$BAK" ]; then
  if [ ! -f "$STATE" ] || [ ! -s "$STATE" ] || [ "$(wc -c <"$STATE" 2>/dev/null || echo 0)" -lt 64 ]; then
    cp "$BAK" "$STATE"
  fi
fi

# idempotent: already up -> refresh backup and exit (no churn)
if pidof tailscaled >/dev/null 2>&1; then
  OUT=$(PATH=/tmp/fakebin:$PATH busybox timeout 12 /usr/bin/tailscale status 2>&1) || OUT="failed to connect"
  if ! echo "$OUT" | grep -qiE 'Logged out|NeedsLogin|failed to connect|stopped|Terminated'; then
    [ -f "$STATE" ] && cp "$STATE" "$BAK" 2>/dev/null; sync
    exit 0
  fi
  # logged out with stale daemon: restart clean
  killall tailscaled 2>/dev/null
  sleep 2
  rm -f "$SOCK" /var/run/tailscaled.pid
fi

# start daemon if missing (userspace networking; this kernel has no TUN)
if ! pidof tailscaled >/dev/null 2>&1; then
  rm -f /var/run/tailscaled.pid "$SOCK" 2>/dev/null
  PATH=/tmp/fakebin:$PATH setsid /usr/sbin/tailscaled \
    --state="$STATE" --socket="$SOCK" --port=41641 --tun=userspace-networking \
    </dev/null >>"$LOG" 2>&1 &
  i=0
  while [ "$i" -lt 20 ]; do
    test -S "$SOCK" && break
    i=$((i + 1))
    sleep 2
  done
fi

KEY=$(awk -F= '/^TAILSCALE_AUTH_KEY=/{print $2}' /media/mmc/hack.ini | tr -d '\r')
if [ -z "$KEY" ]; then
  echo "$(date -Is) tailscale_wrapper: missing TAILSCALE_AUTH_KEY" >>"$LOG"
  exit 1
fi

PATH=/tmp/fakebin:$PATH busybox timeout 90 /usr/bin/tailscale up \
  --auth-key="$KEY" --hostname=atomcam33 --advertise-tags=tag:server --ssh --timeout=60s \
  >>"$LOG" 2>&1 || echo "$(date -Is) tailscale up failed rc=$?" >>"$LOG"

# persist identity after (re)registration
[ -f "$STATE" ] && [ "$(wc -c <"$STATE" 2>/dev/null || echo 0)" -ge 64 ] && cp "$STATE" "$BAK" 2>/dev/null
sync
