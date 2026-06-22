#!/usr/bin/env bash
# Build target/tools_configs ext2 with wpa_supplicant.conf (no sudo; uses debugfs).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
WIFI_ENV="${ATOMCAM_WIFI_ENV:-$HOME/.cursor/secrets/atomcam-wifi.env}"
OUT="$ROOT/target/tools_configs"
EXAMPLE="$ROOT/config/wpa_supplicant.conf.example"
SIZE_MB="${TOOLS_CONFIGS_SIZE_MB:-1}"

if [[ ! -f "$WIFI_ENV" ]]; then
  echo "build-tools-configs: missing $WIFI_ENV" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$WIFI_ENV"
WIFI_SSID="${WIFI_SSID//$'\r'/}"
WIFI_PASS="${WIFI_PASS//$'\r'/}"

if [[ -z "${WIFI_SSID:-}" || -z "${WIFI_PASS:-}" ]]; then
  echo "build-tools-configs: WIFI_SSID and WIFI_PASS required" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/configs/etc"
cat > "$WORK/wpa_supplicant.conf" <<EOF
ctrl_interface=/var/run/wpa_supplicant
update_config=1

network={
    ssid="${WIFI_SSID}"
    scan_ssid=1
    key_mgmt=WPA-PSK
    proto=RSN
    pairwise=CCMP
    group=CCMP
    psk="${WIFI_PASS}"
}
EOF
# CRLF 混入防止（wpa_supplicant が ssid/psk を誤認する）
sed -i 's/\r$//' "$WORK/wpa_supplicant.conf"

rm -f "$OUT"
dd if=/dev/zero of="$OUT" bs=1M count="$SIZE_MB" status=none
mkfs.ext2 -F "$OUT" >/dev/null

CMD="$WORK/debugfs.cmd"
cat > "$CMD" <<EOF
mkdir /configs
mkdir /configs/etc
write ${WORK}/wpa_supplicant.conf /configs/etc/wpa_supplicant.conf
ls /configs/etc
quit
EOF

debugfs -w -f "$CMD" "$OUT" >/dev/null

cp "$WORK/wpa_supplicant.conf" "$ROOT/target/wpa_supplicant.conf"
echo "build-tools-configs: wrote $ROOT/target/wpa_supplicant.conf (FAT root fallback)"

echo "build-tools-configs: wrote $OUT ($(wc -c <"$OUT") bytes)"
