#!/usr/bin/env bash
# Merge authorized_keys for agent/full profiles into target/ and buildroot images output.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
TARGET="${TARGET_DIR:-$ROOT/target}"
OUT_KEYS="$TARGET/authorized_keys"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

touch "$STAGE/keys"

# lll-buildhost / 既存 target
if [ -f "$OUT_KEYS" ]; then
  grep -v '^[[:space:]]*$' "$OUT_KEYS" >>"$STAGE/keys" || true
fi

# デバッグ鍵（git 外）
DEBUG_PUB="${ATOMCAM_DEBUG_PUB:-$HOME/.cursor/secrets/atomcam-debug/id_ed25519.pub}"
if [ -f "$DEBUG_PUB" ]; then
  cat "$DEBUG_PUB" >>"$STAGE/keys"
fi

# 追加鍵ファイル
EXTRA="${ATOMCAM_AUTHORIZED_KEYS_EXTRA:-}"
if [ -n "$EXTRA" ] && [ -f "$EXTRA" ]; then
  grep -v '^[[:space:]]*$' "$EXTRA" >>"$STAGE/keys" || true
fi

# 重複行除去
awk '!seen[$0]++' "$STAGE/keys" >"$OUT_KEYS"
echo "merge-authorized-keys: $(wc -l <"$OUT_KEYS") key(s) -> $OUT_KEYS"

# post_image が空 touch する前に images 側も更新（ビルド中）
IMAGES_DIR="${IMAGES_DIR:-}"
if [ -n "$IMAGES_DIR" ] && [ -d "$IMAGES_DIR" ]; then
  cp "$OUT_KEYS" "$IMAGES_DIR/authorized_keys"
fi
