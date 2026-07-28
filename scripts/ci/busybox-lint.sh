#!/bin/bash
# busybox-lint — デバイス(busybox 1.37 ash)行きスクリプトの互換ゲート
#
# 実バグの再発防止が目的(いずれも 2026-07 に実機で顕在化):
#   - awk の -v をプログラム後置 → POSIX では operand 扱いで BEGIN 時に未定義 →
#     getline<"" が -1 で while(-1) 無限ループ = awk storm (d26ee24)
#   - busybox find に -delete が無く自動削除が全滅 (8a39f6a)
#
# 検査:
#   1) busybox ash -n による構文検査
#   2) busybox 1.37 に無い機能・bash 専用機能の静的検査
#
# usage: busybox-lint.sh
#   BUSYBOX=/path/to/busybox で使用バイナリを上書き可(CI は busybox-static)
# exit: 0=clean 1=violation 2=busybox なし
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 2
BB="${BUSYBOX:-busybox}"

if ! command -v "$BB" >/dev/null 2>&1; then
  echo "busybox が見つかりません(BUSYBOX= で指定可)" >&2
  exit 2
fi

# 対象: デバイス上で busybox ash が実行するスクリプトのみ。
# ビルドホスト(bash)で走る scripts/ 直下・buildscripts/ は対象外。
TARGETS="$(
  find overlay_rootfs/scripts overlay_rootfs/etc/init.d overlay_rootfs/atom_patch \
       overlay_rootfs/var/www/cgi-bin scripts/hil/debug initramfs_skeleton \
       -type f 2>/dev/null \
    | while IFS= read -r f; do
        # shebang が sh 系、または実行可能でシェルスクリプトと判定できるものだけ
        head -1 "$f" 2>/dev/null | grep -qE '^#!.*\b(a|da|busybox +a|)sh\b' && printf '%s\n' "$f"
      done
)"

[ -n "$TARGETS" ] || { echo "対象スクリプトが見つかりません" >&2; exit 2; }

FAIL=0
N=0

# --- 1) 構文検査 (busybox ash -n) -------------------------------------------
while IFS= read -r f; do
  N=$((N + 1))
  ERR="$("$BB" ash -n "$f" 2>&1)" || {
    echo "SYNTAX  $f"
    echo "$ERR" | sed 's/^/        /'
    FAIL=1
  }
done <<EOF_TARGETS
$TARGETS
EOF_TARGETS

# --- 2) 罠の静的検査 ----------------------------------------------------------
# check PATTERN LABEL
#   コメント行(先頭が #)は除外。ヒットしたら該当行を表示して fail。
check() {
  local pattern="$1" label="$2" hits
  hits="$(
    while IFS= read -r f; do
      grep -nE "$pattern" "$f" /dev/null 2>/dev/null | grep -vE '^[^:]+:[0-9]+:[[:space:]]*#'
    done <<EOF_T
$TARGETS
EOF_T
  )"
  if [ -n "$hits" ]; then
    echo "TRAP    $label"
    echo "$hits" | sed 's/^/        /'
    FAIL=1
  fi
}

# busybox find に -delete は無い (8a39f6a: 自動削除全滅)
# ※ /tmp/system/bin/find 等「絶対パスで呼ぶ純正 find」は busybox ではないため対象外
check '(^|[^/A-Za-z])find[[:space:]][^|;&]*-delete' 'find -delete (busybox find に無い → -exec rm へ)'

# awk の -v がプログラム(引用文字列)の後 → operand 扱いで BEGIN 時未定義 (d26ee24: awk storm)
check "awk[[:space:]]+('[^']*'|\"[^\"]*\")[[:space:]]+-v[[:space:]]" 'awk -v のプログラム後置 (POSIX では operand → BEGIN で未定義)'

# busybox grep に PCRE(-P) は無い
check '\bgrep[[:space:]]+-[a-zA-Z]*P' 'grep -P (busybox に PCRE なし → -E へ)'

# bash 専用のケース変換・配列は ash に無い
check '\$\{[A-Za-z_][A-Za-z_0-9]*(\^\^|,,)[^}]*\}' 'bash 専用ケース変換 ${var^^}/${var,,} (ash 不可)'
check '^[[:space:]]*(declare|typeset|local -[aA])[[:space:]]' 'declare/typeset (ash に無い → 素の代入へ)'

# デバイスに bash は無い: 対象ディレクトリ内の bash shebang を検出
# (bash shebang のファイルは TARGETS の sh 判定から漏れるため別途スキャン)
BASH_SHEBANGS="$(
  find overlay_rootfs/scripts overlay_rootfs/etc/init.d overlay_rootfs/atom_patch \
       overlay_rootfs/var/www/cgi-bin scripts/hil/debug initramfs_skeleton -type f 2>/dev/null \
    | while IFS= read -r f; do
        head -1 "$f" 2>/dev/null | grep -qE '^#!.*\bbash\b' && printf '%s\n' "$f"
      done
)"
if [ -n "$BASH_SHEBANGS" ]; then
  echo "TRAP    bash shebang (実機に bash は無い → #!/bin/sh へ)"
  echo "$BASH_SHEBANGS" | sed 's/^/        /'
  FAIL=1
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "busybox-lint: OK (${N} scripts, $("$BB" | head -1 | awk '{print $1, $2}'))"
else
  echo "busybox-lint: NG — 上記を修正してください(詳細は docs/development/guardrails.md §5)" >&2
fi
exit "$FAIL"
