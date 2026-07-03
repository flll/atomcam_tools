#!/usr/bin/env python3
"""F-3 overlay-bake: restore LD_PRELOAD in atom_init.sh, append refactor-notes."""
from pathlib import Path

root = Path("/home/lll/atomcam_tools")
atom = root / "overlay_rootfs/atom_patch/system_bin/atom_init.sh"
notes = root / "docs/development/refactor-notes.md"

text = atom.read_text()
old = """# F-3: libcallback(LD_PRELOAD) triggers SIGSEGV on this build; run iCamera without it.
/system/bin/iCamera_app >> /var/run/atomapp 2>> /$TOOLS_LOG &"""
new = """# F-3 resolved (2026-06-30): LD_PRELOAD restored; stdout to /dev/null avoids FIFO awk storm.
LD_PRELOAD=/tmp/system/lib/modules/libcallback.so /system/bin/iCamera_app >/dev/null 2>&1 &"""
if old not in text:
    raise SystemExit("atom_init.sh pattern not found")
atom.write_text(text.replace(old, new, 1))
print("atom_init.sh updated")

entry = """
### F-3 (解決 2026-06-30): iCamera_app + libcallback.so SIGSEGV
- **原因**: `property.c` の iCamera バイナリ走査が本 FW レイアウトで未マップ領域を読み SIGSEGV。
  加えて `command.c` の `PRODUCT_MODEL` NULL 参照、試験時の FIFO (`>> /var/run/atomapp`) による webhook 暴走・stale PID 誤判定が調査を混乱させた。
- **修正**:
  - `property.c`: `set_property_init` 先頭で走査スキップ (F-3 guard)
  - `command.c`: `getenv("PRODUCT_MODEL")` NULL ガード + `unsetenv("LD_PRELOAD")`
  - `atom_init`: LD_PRELOAD 復帰、`iCamera_app` stdout を `/dev/null` へ（FIFO 回避）
  - HIL: `f3-chroot-test.sh` / `atom_init.f3icamera-only.fixed`（insmod なし単体再起動 + trap 復元）
- **検証**: tier t0..full 全 PASS、`full` + port **4000** LISTEN、`/scripts/cmd audio` 応答。
  成果物 md5 `ebcebb7a` (`libcallback.f3-full.so`)。
- **overlay**: `atom_init.sh` に LD_PRELOAD 行を戻した（次回 `make build` で焼き込み）。
- **mmc 暫定**: `atom_init.preload.fixed` で `/media/mmc/libcallback.so` 経由の本番同等試験可能。
  恒久化後は wdkeep/killwebhook/no-preload ハックを段階撤去。
"""
if "F-3 (解決 2026-06-30)" not in notes.read_text():
    notes.write_text(notes.read_text().rstrip() + "\n" + entry)
    print("refactor-notes.md appended")
else:
    print("refactor-notes.md already has F-3 resolution")
