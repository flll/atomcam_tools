#!/usr/bin/env bash
# Verify sd_initial.zip file count and known artifact sizes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
ZIP="${1:-$ROOT/target/sd_initial.zip}"
CFG="$ROOT/config/sd-install.json"

if [[ ! -f "$ZIP" ]]; then
  echo "sd-package-verify: missing $ZIP" >&2
  exit 1
fi

python3 - "$ZIP" "$CFG" <<'PY'
import json, sys, zipfile
zip_path, cfg_path = sys.argv[1], sys.argv[2]
with open(cfg_path) as f:
    cfg = json.load(f)
required = set(cfg["packageFiles"])
optional = set(cfg.get("optionalBootstrapFiles", []))
expected = cfg.get("expectedFiles", {})

with zipfile.ZipFile(zip_path) as zf:
    names = {n.split("/")[-1] for n in zf.namelist() if not n.endswith("/")}
    missing = required - names
    if missing:
        print(f"sd-package-verify: missing required: {sorted(missing)}", file=sys.stderr)
        sys.exit(10)
    for name, want in expected.items():
        info = next((i for i in zf.infolist() if i.filename.split("/")[-1] == name), None)
        if not info:
            continue
        if info.file_size != want:
            print(f"sd-package-verify: size mismatch {name}: {info.file_size} != {want}", file=sys.stderr)
            sys.exit(10)
    extra = names - required - optional
    if extra:
        print(f"sd-package-verify: unexpected files: {sorted(extra)}", file=sys.stderr)
        sys.exit(10)

print("sd-package-verify: ok")
PY
