#!/bin/bash
# LED 計装を完全に取り消す。
# 注意: uzImage.bin / vmlinuz.bin / vmlinuz を削除する。
#       apply.sh は実行時に ~/atomcam71/known-good/ へ退避しているのでそちらから戻せる。
set -e
K=${K:-$HOME/thingino-firmware/output/master/atom_cam2_t31x_gc2053_atbm6031-7.1-rc1-uclibc/build/linux-92b684b3674ed0ea2bd0c96b6b151402b19fd666}
I=$(cd "$(dirname "$0")" && pwd)

echo "== パッチを逆当て (番号の大きい方から) =="
for p in $(ls -r "$I"/000*.patch); do
	if patch -p1 -d "$K" -R --dry-run -N < "$p" > /dev/null 2>&1; then
		patch -p1 -d "$K" -R -N < "$p" && echo "   reverted $(basename "$p")"
	else
		echo "   skip (当たっていない) $(basename "$p")"
	fi
done

echo "== 追加したヘッダを削除 =="
rm -fv "$K/arch/mips/include/asm/ledprobe.h" \
       "$K/arch/mips/include/asm/ledprobe_tail.h"

echo "== 古いイメージを削除 (再ビルドを強制する) =="
rm -fv "$K"/arch/mips/boot/uzImage.bin "$K"/arch/mips/boot/vmlinuz.bin \
       "$K"/vmlinuz 2>/dev/null || true

echo
echo "残差確認 (何も出なければ完全に戻っている):"
grep -rn 'ledp_\|LEDPROBE\|ledprobe' \
     "$K/arch/mips/boot/compressed/head.S" \
     "$K/arch/mips/boot/compressed/decompress.c" \
     "$K/arch/mips/kernel/head.S" \
     "$K/init/main.c" || echo "   clean"
