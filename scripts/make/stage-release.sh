#!/usr/bin/env bash
# Stage the single canonical build artifact with a short git-tagged name and
# stable symlinks (atomcam_tools.zip = deploy alias, target/sd_initial.zip = SD alias).
# zip は1本(6ファイル/スーパーセット)。deploy 時の2ファイル除去は deploy_remote が担う。
# usage:
#   stage-release.sh canonical ZIP_PATH   # 1本の正本 zip を登録
#   stage-release.sh manifest-only        # 既存 symlink から manifest 再生成
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
META_SH="$ROOT/scripts/make/build-metadata.sh"
RELEASES="$ROOT/target/releases"
TARGET="$ROOT/target"
MANIFEST="$TARGET/BUILD_MANIFEST.json"

mkdir -p "$RELEASES"

register() {
  local src="$1" name dest
  name="$("$META_SH" artifact-name)"
  dest="$RELEASES/$name"
  cp -f "$src" "$dest"
  # 両 symlink を同一正本へ
  ln -sfn "$dest" "$ROOT/atomcam_tools.zip"
  ln -sfn "$dest" "$TARGET/sd_initial.zip"
  echo "stage-release: canonical -> releases/$name" >&2
  echo "  aliases: atomcam_tools.zip (deploy) , target/sd_initial.zip (SD)" >&2
  echo "$dest"
}

update_manifest() {
  local canonical="${1:-}"
  python3 - "$MANIFEST" "$META_SH" "$canonical" "$RELEASES" "$ROOT" <<'PY'
import json, subprocess, sys
from pathlib import Path
manifest = Path(sys.argv[1]); meta_sh = sys.argv[2]
canonical = sys.argv[3]; releases = Path(sys.argv[4]); root = Path(sys.argv[5])

meta = json.loads(subprocess.check_output([meta_sh, "print-json"], text=True))
p = Path(canonical) if canonical else None
artifact = {}
if p and p.is_file():
    artifact = {"path": str(p), "name": p.name, "bytes": p.stat().st_size}

out = {
    **meta,
    "artifact": artifact,                       # 1本の正本
    "aliases": {
        "deploy": str(root / "atomcam_tools.zip"),
        "sd": str(root / "target/sd_initial.zip"),
    },
    "deploy_note": "OTA は deploy_remote が hack.ini/tools_configs を除いた一時 zip を送る",
    "releases_dir": str(releases),
}
manifest.parent.mkdir(parents=True, exist_ok=True)
manifest.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
latest = releases.parent / "LATEST.txt"
latest.write_text((f"artifact={artifact['name']}\n" if artifact else "") +
                  f"profile={meta['build_profile']}\ncommit={meta['git_commit_short']}\n")
print(f"stage-release: wrote {manifest}", file=sys.stderr)
PY
}

MODE="${1:-}"; ARG="${2:-}"
case "$MODE" in
  canonical)
    [ -f "$ARG" ] || { echo "missing zip: $ARG" >&2; exit 1; }
    OUT="$(register "$ARG")"
    update_manifest "$OUT"
    ;;
  manifest-only)
    C=""
    [ -L "$TARGET/sd_initial.zip" ] && C="$(readlink -f "$TARGET/sd_initial.zip" 2>/dev/null || true)"
    update_manifest "$C"
    ;;
  *)
    echo "usage: $0 canonical ZIP_PATH | manifest-only" >&2
    exit 1
    ;;
esac
