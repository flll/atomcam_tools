#!/usr/bin/env python3
"""Update flash-fix.sh for optional F3 preload mmc deploy."""
from pathlib import Path

ff = Path("/home/lll/atomcam_tools/scripts/hil/flash-fix.sh")
dbg = Path("/home/lll/atomcam_tools/scripts/hil/debug")
hil = Path("/home/lll/atomcam_tools/scripts/hil")

# Preserve no-preload template under explicit name
nopreload = dbg / "atom_init.fixed"
backup = dbg / "atom_init.nopreload.fixed"
if not backup.exists():
    backup.write_text(nopreload.read_text())
    print("created atom_init.nopreload.fixed")

text = ff.read_text()
needle = '    push_file "$DBG/atom_init.fixed" /media/mmc/atom_init.fixed'
insert = '''    if [ "${F3_PRELOAD:-}" = "1" ]; then
      push_file "$ROOT/scripts/hil/atom_init.preload.fixed" /media/mmc/atom_init.fixed
      if [ -f "$ROOT/libcallback/libcallback.f3-full.so" ]; then
        push_file "$ROOT/libcallback/libcallback.f3-full.so" /media/mmc/libcallback.so
      fi
    else
      push_file "$DBG/atom_init.fixed" /media/mmc/atom_init.fixed
    fi'''
if needle in text and "F3_PRELOAD" not in text:
    ff.write_text(text.replace(needle, insert, 1))
    print("flash-fix.sh updated with F3_PRELOAD=1 option")
elif "F3_PRELOAD" in text:
    print("flash-fix.sh already has F3_PRELOAD")
else:
    raise SystemExit("flash-fix pattern not found")

readme = dbg / "README.md"
append = """
## F-3 解決後 (2026-06-30)

- `atom_init.nopreload.fixed` — 旧安定化（LD_PRELOAD なし）。退避用。
- `scripts/hil/atom_init.preload.fixed` — **本番同等** mmc 上書き（`/media/mmc/libcallback.so` + LD_PRELOAD）。
- `F3_PRELOAD=1 bash scripts/hil/flash-fix.sh` で preload 版を配信。
- overlay `atom_init.sh` も LD_PRELOAD 復帰済み（次回 `make build` で焼き込み）。
- wdkeep / killwebhook は当面維持。overlay 焼き後に段階撤去。
"""
if "F-3 解決後" not in readme.read_text():
    readme.write_text(readme.read_text().rstrip() + "\n" + append)
    print("debug/README.md updated")
