#!/bin/sh
# LINE Seed JP のサブセットを再生成する(翻訳変更で文字が増えたら実行)。
# 元フォント: seed.line.me の LINE_Seed_JP.zip(SIL OFL 1.1)
# 使い方: sh scripts/subset-lineseed.sh /path/to/LINESeedJP_*/Web/WOFF2
set -eu
SRC="${1:?woff2 ディレクトリを指定}"
python3 -m venv /tmp/ftenv 2>/dev/null || true
/tmp/ftenv/bin/pip install --quiet fonttools brotli
python3 - <<'PY'
import json, pathlib
chars = set()
for fp in pathlib.Path('public/locales/ja').glob('*.json'):
    chars.update(fp.read_text(encoding='utf-8'))
yaml = pathlib.Path('../web/source/vue/i18n-ja.yaml')
if yaml.exists():
    chars.update(yaml.read_text(encoding='utf-8'))
for r in [(0x20, 0x7E), (0x3040, 0x30FF), (0xFF01, 0xFF60), (0x2010, 0x203B)]:
    chars.update(chr(c) for c in range(r[0], r[1] + 1))
open('/tmp/lineseed-chars.txt', 'w', encoding='utf-8').write(''.join(sorted(c for c in chars if ord(c) >= 0x20)))
PY
for W in Rg Bd; do
  /tmp/ftenv/bin/pyftsubset "$SRC/LINESeedJP_OTF_${W}.woff2" \
    --flavor=woff2 --text-file=/tmp/lineseed-chars.txt \
    --layout-features='*' --no-hinting --desubroutinize \
    --output-file="src/assets/fonts/LINESeedJP-${W}-subset.woff2"
done
ls -la src/assets/fonts/
