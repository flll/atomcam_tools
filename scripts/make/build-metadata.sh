#!/usr/bin/env bash
# Git / profile / version metadata for one traceable build artifact name.
# zip は1本(スーパーセット)。deploy 時に deploy_remote が hack.ini/tools_configs を除く。
# usage: build-metadata.sh [print-env|print-json|artifact-name]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
cd "$ROOT"

python3 - "$ROOT" "${1:-print-env}" <<'PY'
import json, re, subprocess, sys
from datetime import datetime
from pathlib import Path

root = Path(sys.argv[1])
cmd = sys.argv[2]

def run_git(args, default="unknown"):
    try:
        return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()
    except Exception:
        return default

def slug(text, limit=48):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return (s[:limit].strip("-") or "unknown")

# runtime state moved to target/
profile = "tailscale"
active = root / "target/active_profile.name"
if active.is_file():
    profile = active.read_text().strip() or profile

atomhack_ver = "unknown"
ver_file = root / "configs/atomhack.ver"
if ver_file.is_file():
    atomhack_ver = ver_file.read_text().strip()

commit_full = run_git(["rev-parse", "HEAD"])
commit_short = run_git(["rev-parse", "--short", "HEAD"])
describe = run_git(["describe", "--tags", "--always", "--dirty"])
subject = run_git(["log", "-1", "--format=%s"])
tag_latest = run_git(["describe", "--tags", "--abbrev=0"], "none")

# short single artifact name: atomcam-{commit}[-{profile}].zip
# simple プロファイルは suffix を付けない
suffix = "" if profile == "simple" else f"-{profile}"
artifact_name = f"atomcam-{commit_short}{suffix}.zip"

ts = datetime.now().strftime("%Y%m%d_%H%M%S")

meta = {
    "atomhack_ver": atomhack_ver,
    "build_profile": profile,
    "git_commit_full": commit_full,
    "git_commit_short": commit_short,
    "git_describe": describe,
    "git_tag_latest": tag_latest,
    "git_subject": subject,
    "git_subject_slug": slug(subject),
    "build_timestamp": ts,
    # 1本化: deploy/sd は同じ正本。互換のため両キーに同値を入れる
    "artifact_name": artifact_name,
    "artifact_name_deploy": artifact_name,
    "artifact_name_sd": artifact_name,
}

if cmd == "print-env":
    for k, v in meta.items():
        print(f"{k.upper()}={v}")
elif cmd == "print-json":
    print(json.dumps(meta, indent=2, ensure_ascii=False))
elif cmd in ("artifact-name", "artifact-name-deploy", "artifact-name-sd"):
    print(artifact_name)
else:
    print(f"unknown command: {cmd}", file=sys.stderr)
    sys.exit(1)
PY
