#!/usr/bin/env bash
# Post-build steps per active BUILD_PROFILE (runs in container or host with TARGET_DIR).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
ACTIVE_ENV="$ROOT/target/active_build_profile.env"
TARGET="${TARGET_DIR:-$ROOT/target}"
IMAGES_DIR="${IMAGES_DIR:-}"

if [ ! -f "$ACTIVE_ENV" ]; then
  echo "post-build-profile: no active profile — skip"
  exit 0
fi

# shellcheck disable=SC1090
. "$ACTIVE_ENV"

mkdir -p "$TARGET"

stage_hil_assets() {
  local dest="$TARGET/hil-bootstrap"
  mkdir -p "$dest"
  cp -f "$ROOT/scripts/hil/debug/README.md" "$dest/" 2>/dev/null || true
  cp -f "$ROOT/docs/development/hil-bootstrap.md" "$dest/" 2>/dev/null || true
  cp -f "$ROOT/docs/development/debug-hil-loop.md" "$dest/" 2>/dev/null || true
  echo "post-build-profile: staged HIL docs -> $dest"
}

stage_harness_mmc() {
  local tmpl="$ROOT/scripts/hil/templates"
  local dest="$TARGET/mmc_templates"
  mkdir -p "$dest"
  if [ -d "$tmpl" ]; then
    cp -f "$tmpl/"*.fixed "$dest/" 2>/dev/null || true
  fi
  echo "post-build-profile: mmc templates -> $dest"
  echo "  SD へコピー: S61atomcam.fixed atom_init.fixed を /media/mmc/ へ"
}

if [ "${INCLUDE_HIL_ASSETS:-n}" = "y" ]; then
  stage_hil_assets
fi

if [ "${INCLUDE_HARNESS_MMC:-n}" = "y" ]; then
  stage_harness_mmc
fi

if [ "${INCLUDE_AGENT_KEYS:-n}" = "y" ]; then
  export TARGET_DIR="$TARGET"
  if [ -n "$IMAGES_DIR" ]; then
    export IMAGES_DIR
  fi
  "$ROOT/scripts/make/merge-authorized-keys.sh"
fi

if [ "${SD_PACKAGE_AFTER_BUILD:-n}" = "y" ] && [ -z "${INSIDE_DOCKER_BUILD:-}" ]; then
  if [ -f "$TARGET/rootfs_hack.squashfs" ]; then
  echo "post-build-profile: running sd-package (profile=${BUILD_PROFILE:-?})"
    "$ROOT/scripts/hil/sd-package.sh" || echo "post-build-profile: sd-package warning (secrets may be missing)" >&2
  fi
fi

echo "post-build-profile: done (profile=${BUILD_PROFILE:-unknown})"
