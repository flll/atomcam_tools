#!/usr/bin/env bash
# Patch wpa_supplicant.conf inside tools_configs ext2 (debugfs, no mount).
set -euo pipefail

IMG="${1:-}"
WPA="${2:-}"
if [[ -z "$IMG" || -z "$WPA" || ! -f "$IMG" || ! -f "$WPA" ]]; then
  echo '{"error":"usage: patch-tools-configs-wpa.sh <tools_configs> <wpa_supplicant.conf>"}' >&2
  exit 1
fi

CMD="$(mktemp)"
trap 'rm -f "$CMD"' EXIT
cat > "$CMD" <<EOF
mkdir /configs
mkdir /configs/etc
write ${WPA} /configs/etc/wpa_supplicant.conf
ls /configs/etc
quit
EOF

debugfs -w -f "$CMD" "$IMG" >/dev/null
echo '{"ok":true,"image":"'"$IMG"'"}'
