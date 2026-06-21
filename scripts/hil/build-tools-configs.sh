#!/usr/bin/env bash
# Build target/tools_configs ext2 with wpa_supplicant.conf from secrets (bootstrap WiFi 方針 B).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
WIFI_ENV="${ATOMCAM_WIFI_ENV:-$HOME/.cursor/secrets/atomcam-wifi.env}"
OUT="$ROOT/target/tools_configs"
EXAMPLE="$ROOT/config/wpa_supplicant.conf.example"
SIZE_MB="${TOOLS_CONFIGS_SIZE_MB:-8}"

if [[ ! -f "$WIFI_ENV" ]]; then
  echo "build-tools-configs: missing $WIFI_ENV" >&2
  echo "  Create from config/wpa_supplicant.conf.example or use 純正アプリ WiFi 設定 (方針 A)" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$WIFI_ENV"

if [[ -z "${WIFI_SSID:-}" || -z "${WIFI_PASS:-}" ]]; then
  echo "build-tools-configs: WIFI_SSID and WIFI_PASS required in $WIFI_ENV" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/configs/etc"
if [[ -f "$EXAMPLE" ]]; then
  sed -e "s/YOUR_SSID/${WIFI_SSID}/g" -e "s/YOUR_PASSWORD/${WIFI_PASS}/g" "$EXAMPLE" \
    | grep -v '^#' | grep -v '^$' > "$WORK/configs/etc/wpa_supplicant.conf"
else
  cat > "$WORK/configs/etc/wpa_supplicant.conf" <<EOF
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
fi

rm -f "$OUT"
dd if=/dev/zero of="$OUT" bs=1M count="$SIZE_MB" status=none
mkfs.ext2 -F "$OUT"
mkdir -p "$WORK/mnt"
sudo mount -o loop "$OUT" "$WORK/mnt"
sudo mkdir -p "$WORK/mnt/configs/etc"
sudo cp "$WORK/configs/etc/wpa_supplicant.conf" "$WORK/mnt/configs/etc/wpa_supplicant.conf"
sudo umount "$WORK/mnt"

echo "build-tools-configs: wrote $OUT ($(wc -c <"$OUT") bytes)"
