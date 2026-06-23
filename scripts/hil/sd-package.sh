#!/usr/bin/env bash
# Assemble the single canonical AtomCam zip (superset: 4 build files + hack.ini + WiFi).
# これが正本。SD はそのまま使用。OTA deploy 時は deploy_remote が hack.ini/tools_configs を除く。
# Tailscale keys are injected from ~/.cursor/secrets/atomcam-tailscale.env (git 外).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
TARGET="$ROOT/target"
BUILD_ZIP="$TARGET/.sd_build.zip"
BOOT_INI="$ROOT/config/hack.ini.bootstrap"
TS_ENV="${ATOMCAM_TAILSCALE_ENV:-$HOME/.cursor/secrets/atomcam-tailscale.env}"
WIFI_ENV="${ATOMCAM_WIFI_ENV:-$HOME/.cursor/secrets/atomcam-wifi.env}"
VERIFY=0

for arg in "$@"; do
  case "$arg" in
    --verify) VERIFY=1 ;;
    --help|-h) echo "usage: $0 [--verify]"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

required=(
  "$TARGET/factory_t31_ZMC6tiIDQN"
  "$TARGET/rootfs_hack.squashfs"
  "$TARGET/hostname"
  "$TARGET/authorized_keys"
)

# 全要素を検査(以前は "$required" で先頭しか見ていなかった)
for f in "${required[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "sd-package: missing $f (run make build first)" >&2
    exit 1
  fi
done

if [[ ! -f "$BOOT_INI" ]]; then
  echo "sd-package: missing $BOOT_INI" >&2
  exit 1
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp "$TARGET/factory_t31_ZMC6tiIDQN" "$STAGE/"
cp "$TARGET/rootfs_hack.squashfs" "$STAGE/"
cp "$TARGET/hostname" "$STAGE/"
cp "$TARGET/authorized_keys" "$STAGE/"

{
  cat "$BOOT_INI"
  if [[ -f "$TS_ENV" ]]; then
    grep -E '^TAILSCALE_' "$TS_ENV" || true
  else
    echo "sd-package: warning: no tailscale env at $TS_ENV" >&2
  fi
} > "$STAGE/hack.ini"

# Optional: WiFi on FAT root (network_init.sh が最優先で読む)
if [[ -f "$TARGET/wpa_supplicant.conf" ]]; then
  cp "$TARGET/wpa_supplicant.conf" "$STAGE/wpa_supplicant.conf"
fi
if [[ -f "$TARGET/tools_configs" ]]; then
  cp "$TARGET/tools_configs" "$STAGE/tools_configs"
fi

rm -f "$BUILD_ZIP"
(cd "$STAGE" && zip -ry "$BUILD_ZIP" .)
echo "sd-package: built canonical zip ($(wc -c <"$BUILD_ZIP") bytes, $(find "$STAGE" -maxdepth 1 -type f | wc -l) files)"

# 短名で releases へ登録し、atomcam_tools.zip / target/sd_initial.zip の両 symlink を張る
chmod +x "$ROOT/scripts/make/stage-release.sh" "$ROOT/scripts/make/build-metadata.sh" 2>/dev/null || true
"$ROOT/scripts/make/stage-release.sh" canonical "$BUILD_ZIP"
rm -f "$BUILD_ZIP"

if [[ "$VERIFY" -eq 1 ]]; then
  "$ROOT/scripts/hil/sd-package-verify.sh" "$TARGET/sd_initial.zip"
fi
