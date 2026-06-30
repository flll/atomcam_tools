#!/bin/bash
# web-new の var/www を既存 rootfs_hack.squashfs にマージして再パックする。
# フル make build の代替（開発向け）。出力は target/rootfs_hack_webui.squashfs（root 所有の上書きはしない）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
HOST="${ATOMCAM_HOST:-10.0.0.228}"
SQUASH_IN="${1:-$ROOT/target/rootfs_hack.squashfs}"
SQUASH_OUT="${2:-/tmp/rootfs_hack_webui.squashfs}"
WORK=/tmp/rootfs-webui-repack
WWW_TAR=/tmp/web-new-var-www.tar
WWW_STAGING=/tmp/web-new-var-www

bash "$ROOT/scripts/hil/verify-webui-build.sh"
docker compose up -d
docker compose exec -T builder bash -lc \
  'cd /atomtools/build/buildroot-2026.02.1/output/target/var/www && tar cf - .' > "$WWW_TAR"
rm -rf "$WWW_STAGING" "$WORK"
mkdir -p "$WWW_STAGING"
tar -xf "$WWW_TAR" -C "$WWW_STAGING"
unsquashfs -d "$WORK" -f "$SQUASH_IN"
dest="$WORK/var/www"
rm -f "$dest"/bundle_* "$dest"/index.html "$dest"/index.html.gz "$dest"/index.html.br
rm -rf "$dest/assets" "$dest/.vite"
for sub in assets locales .vite; do
  [ -d "$WWW_STAGING/$sub" ] && cp -a "$WWW_STAGING/$sub" "$dest/"
done
for f in index.html index.html.gz index.html.br poster.svg poster.svg.gz poster.svg.br; do
  [ -f "$WWW_STAGING/$f" ] && cp -a "$WWW_STAGING/$f" "$dest/"
done
# 実機 rootfs は root 所有でパックする（fakeroot 必須）
if command -v fakeroot >/dev/null 2>&1; then
  fakeroot mksquashfs "$WORK" "$SQUASH_OUT" -comp xz -noappend -no-progress
else
  echo "warning: fakeroot not found; ownership may break sshd" >&2
  mksquashfs "$WORK" "$SQUASH_OUT" -comp xz -noappend -no-progress
fi
echo "wrote $SQUASH_OUT ($(stat -c%s "$SQUASH_OUT") bytes)"
echo "deploy: scp $SQUASH_OUT root@${HOST}:/media/mmc/update/rootfs_hack.squashfs && ssh root@${HOST} sync\; reboot"
