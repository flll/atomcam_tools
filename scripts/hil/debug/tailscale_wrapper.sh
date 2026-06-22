#!/bin/sh
# fake uname for tailscaled on 3.10.14__isvp_swan_1.0__ kernels
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
[ -w /proc/sys/kernel/osrelease ] && echo 3.10.14 > /proc/sys/kernel/osrelease 2>/dev/null
PATH=/tmp/fakebin:$PATH /scripts/tailscale.sh start
