#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
docker compose up -d
docker compose exec -T -e WEB_UI=web-new builder bash -lc '
set -e
export BUILDROOT_VERSION=2026.02.1
export BASE_DIR=/atomtools/build/buildroot-${BUILDROOT_VERSION}/output
export TARGET_DIR=${BASE_DIR}/target
mkdir -p "$TARGET_DIR/var/www"
cp -a /src/overlay_rootfs/var/www/cgi-bin "$TARGET_DIR/var/www/" 2>/dev/null || true
cp -a /src/overlay_rootfs/var/www/dirindex.css "$TARGET_DIR/var/www/" 2>/dev/null || true
/src/buildscripts/local_build.sh
test -f "$TARGET_DIR/var/www/index.html"
test -d "$TARGET_DIR/var/www/assets"
JS=$(ls "$TARGET_DIR/var/www/assets"/*.js.gz 2>/dev/null | head -1)
test -n "$JS"
echo "verify-webui-build: OK index.html + ${JS}"
'
