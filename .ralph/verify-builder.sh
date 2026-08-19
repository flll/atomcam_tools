#!/usr/bin/env bash
# usage: bash .ralph/verify-builder.sh S14
# docker は lll-legacy。git のコミット数はローカル clone。
set -euo pipefail
STORY="${1:-}"
IMAGE=flll/atomcam_tools-builder:br2026.05
BASE="$(tr -d "[:space:]" < .ralph/loop-base)"
RSH=(ssh -o BatchMode=yes lll-legacy)

if "${RSH[@]}" "docker image inspect $IMAGE >/dev/null 2>&1"; then
  echo "OK: $IMAGE exists"
  "${RSH[@]}" "docker image inspect $IMAGE --format '{{.Id}} {{.Size}}'"
  if [ "$STORY" = "S19" ]; then
    "${RSH[@]}" "cd /home/lll/atomcam_tools && docker compose exec -T builder ls /atomtools/build/buildroot-2026.05.1 >/dev/null"
    echo "OK: compose builder has buildroot-2026.05.1"
  fi
  exit 0
fi

if [ "$STORY" = "S19" ]; then
  echo "FAIL: S19 はイメージ必須"
  exit 1
fi

need=0
case "$STORY" in
  S14) need=1 ;;
  S15) need=2 ;;
  S16) need=3 ;;
  S17) need=4 ;;
  S18) need=5 ;;
  *) echo "FAIL: unknown story $STORY"; exit 1 ;;
esac

n="$(git rev-list --count "${BASE}..HEAD" -- global_patches configs custompackages buildscripts Dockerfile 2>/dev/null || echo 0)"
echo "builder commits since $BASE: $n (need $need)"
if [ "$n" -lt "$need" ]; then
  echo "FAIL: まだ ${need} 件目の builder 修正がない（イメージも未作成）"
  exit 1
fi
if "${RSH[@]}" 'pgrep -f "docker build -t flll/atomcam_tools-builder:br2026.05" >/dev/null'; then
  echo "OK: ${need} 件目まで修正済みで docker build 走行中"
  exit 0
fi
echo "FAIL: 修正コミットはあるが docker build が走っていない"
exit 1
