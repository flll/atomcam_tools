#!/bin/bash
# ビルド後に、実際に出来上がったイメージから検証定数を生成し直す。
#   LEDP_TAILWORD  : 圧縮イメージ末尾 4 バイト (= 解凍後サイズ, LE)
#   LEDP_ENTRYADDR : 解凍後カーネルの入口 (vmlinux の ELF entry)
#   LEDP_ENTRYWORD : そこに置かれているはずの最初の命令ワード
# これを実行してからもう一度 uzImage.bin をビルドすると検証が有効になる。
set -e
K=${K:-$HOME/thingino-firmware/output/master/atom_cam2_t31x_gc2053_atbm6031-7.1-rc1-uclibc/build/linux-92b684b3674ed0ea2bd0c96b6b151402b19fd666}
H=${H:-$HOME/thingino-firmware/output/master/atom_cam2_t31x_gc2053_atbm6031-7.1-rc1-uclibc/host/bin}
BIN=$K/arch/mips/boot/compressed/vmlinux.bin
Z=$K/arch/mips/boot/compressed/vmlinux.bin.z
ELF=$K/vmlinux
HDR=$K/arch/mips/include/asm/ledprobe_tail.h

[ -f "$BIN" ] || { echo "!! $BIN が無い。先に uzImage.bin をビルドすること"; exit 1; }
[ -f "$ELF" ] || { echo "!! $ELF が無い"; exit 1; }

# ---- 1. 解凍後サイズ -------------------------------------------------------
SZ=$(stat -c%s "$BIN")
HEX=$(printf '0x%08x' "$SZ")

# vmlinux.bin.z 末尾 4 バイト(LE)が本当に一致するか検算してから書く
if [ -f "$Z" ]; then
	TAIL=$(tail -c4 "$Z" | xxd -p)
	EXP=$(printf '%08x' "$SZ" | sed 's/\(..\)\(..\)\(..\)\(..\)/\4\3\2\1/')
	if [ "$TAIL" != "$EXP" ]; then
		echo "!! 末尾 4 バイトが一致しない: file=$TAIL expected=$EXP"
		echo "!! 圧縮方式が lzma_with_size ではない可能性がある。中止。"
		exit 1
	fi
	echo "   検算 OK: vmlinux.bin.z tail = $TAIL"
fi

# ---- 2. カーネル入口とその 1 命令目 ----------------------------------------
EA=$("$H/mipsel-linux-readelf" -h "$ELF" | awk '/Entry point address/ {print $NF}')
case "$EA" in
0x*) ;;
*) echo "!! entry point が読めない: '$EA'"; exit 1 ;;
esac
EA_END=$(printf '0x%x' $(( EA + 4 )))
EW=$("$H/mipsel-linux-objdump" -d --start-address="$EA" --stop-address="$EA_END" "$ELF" \
     | awk '/^[[:space:]]*[0-9a-f]+:/ { print $2; exit }')
if [ ${#EW} -ne 8 ]; then
	echo "!! entry word が読めない: '$EW'"; exit 1
fi
# 参考: nm 上のシンボル名も出しておく (kernel_entry のはず)
SYM=$("$H/mipsel-linux-nm" "$ELF" | grep -i " ${EA#0x}\b" | head -1 || true)
echo "   entry = $EA  word = 0x$EW   ${SYM:+($SYM)}"

cat > "$HDR" <<EOT
/* SPDX-License-Identifier: GPL-2.0 */
/* 自動生成: ~/atomcam71/instrument/refresh-tail.sh
 * vmlinux.bin = $SZ bytes ($HEX)
 *   -> .image (= vmlinux.bin.z) 末尾 4 バイトの LE 値と一致するはず
 * kernel entry = $EA  first insn = 0x$EW */
#ifndef __ASM_LEDPROBE_TAIL_H
#define __ASM_LEDPROBE_TAIL_H
#define LEDP_TAILWORD	$HEX
#define LEDP_ENTRYADDR	${EA}
#define LEDP_ENTRYWORD	0x${EW}
#endif
EOT
echo "   wrote $HDR"
echo "   -> もう一度 uzImage.bin をビルドすること"
