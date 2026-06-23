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
mkdir -p /tmp/tailscale /var/run/tailscale

# restore persisted identity on boot
[ -f "$BAK" ] && [ ! -f "$STATE" ] && cp "$BAK" "$STATE"

# idempotent: already up -> refresh backup and exit (no churn)
if pidof tailscaled >/dev/null 2>&1; then
  OUT=$(PATH=/tmp/fakebin:$PATH /usr/bin/tailscale status 2>&1)
  if ! echo "$OUT" | grep -qiE 'Logged out|NeedsLogin|failed to connect|stopped'; then
    [ -f "$STATE" ] && cp "$STATE" "$BAK" 2>/dev/null; sync
    exit 0
  fi
fi

# start daemon if missing (userspace networking; this kernel has no TUN)
if ! pidof tailscaled >/dev/null 2>&1; then
  rm -f /var/run/tailscaled.pid "$SOCK" 2>/dev/null
  PATH=/tmp/fakebin:$PATH setsid /usr/sbin/tailscaled \
    --state="$STATE" --socket="$SOCK" --port=41641 --tun=userspace-networking \
    </dev/null >>/tmp/tsd.log 2>&1 &
  sleep 10
fi

KEY=$(awk -F= '/^TAILSCALE_AUTH_KEY=/{print $2}' /media/mmc/hack.ini | tr -d '\r')
PATH=/tmp/fakebin:$PATH /usr/bin/tailscale up \
  --auth-key="$KEY" --hostname=atomcam33 --advertise-tags=tag:server --ssh --timeout=60s

# persist identity after (re)registration
[ -f "$STATE" ] && cp "$STATE" "$BAK" 2>/dev/null; sync
