#!/bin/bash
# ATOMCam2 7.1 ブート経路 LED 計装 -- 適用スクリプト
#   使い方:  bash ~/atomcam71/instrument/apply.sh
# 何も書き換えずに確認だけするなら:  bash apply.sh --dry-run
set -e

K=${K:-$HOME/thingino-firmware/output/master/atom_cam2_t31x_gc2053_atbm6031-7.1-rc1-uclibc/build/linux-92b684b3674ed0ea2bd0c96b6b151402b19fd666}
H=${H:-$HOME/thingino-firmware/output/master/atom_cam2_t31x_gc2053_atbm6031-7.1-rc1-uclibc/host/bin}
G=${G:-$HOME/atomcam71/known-good}
I=$(cd "$(dirname "$0")" && pwd)
DRY=""
[ "$1" = "--dry-run" ] && DRY="--dry-run"

[ -d "$K" ] || { echo "!! カーネルツリーが無い: $K"; exit 1; }

echo "== 1. パッチが当たるか確認 =="
for p in "$I"/000*.patch; do
	patch -p1 -d "$K" --dry-run -N < "$p" > /dev/null \
		&& echo "   OK  $(basename "$p")" \
		|| { echo "   NG  $(basename "$p")"; exit 1; }
done
[ -n "$DRY" ] && { echo "== --dry-run のためここで終了 =="; exit 0; }

echo "== 2. 既存イメージを known-good へ退避 (step 5 で消すので先に守る) =="
mkdir -p "$G"
TS=$(date +%Y%m%d-%H%M%S)
for f in arch/mips/boot/uzImage.bin arch/mips/boot/vmlinuz.bin vmlinuz \
         arch/mips/boot/compressed/vmlinux.bin arch/mips/boot/compressed/vmlinux.bin.z; do
	[ -f "$K/$f" ] && cp -v "$K/$f" "$G/$(basename "$f").$TS"
done
echo "   -> $G"

echo "== 3. ヘッダを配置 =="
cp -v "$I/ledprobe.h" "$K/arch/mips/include/asm/ledprobe.h"

# 生成される検証定数は既定で無効(=0)。ビルド後に refresh-tail.sh で有効化する。
# 適用直後の vmlinux.bin は「計装前」のサイズなので、そのまま使うと
# 必ず誤検知(E1)になる。だからここでは 0 を書く。
cat > "$K/arch/mips/include/asm/ledprobe_tail.h" <<'EOT'
/* SPDX-License-Identifier: GPL-2.0 */
/* 自動生成: ~/atomcam71/instrument/refresh-tail.sh が上書きする */
#ifndef __ASM_LEDPROBE_TAIL_H
#define __ASM_LEDPROBE_TAIL_H
/* 0 = そのチェックを行わない */
#define LEDP_TAILWORD	0
#define LEDP_ENTRYADDR	0
#define LEDP_ENTRYWORD	0
#endif
EOT
echo "   created $K/arch/mips/include/asm/ledprobe_tail.h (checks disabled)"

echo "== 4. パッチ適用 =="
for p in "$I"/000*.patch; do
	patch -p1 -d "$K" -N < "$p" && echo "   applied $(basename "$p")"
done

echo "== 5. 古いイメージを消す (thingino の make ラッパは uImage があるとスキップする) =="
rm -fv "$K"/arch/mips/boot/uzImage.bin "$K"/arch/mips/boot/vmlinuz.bin \
       "$K"/vmlinuz "$K"/arch/mips/boot/vmlinuz 2>/dev/null || true

cat <<'EOT'

================ 次にやること ================
 1) 1 回目のビルド (検証定数はまだ無効)
      cd $K && PATH=$HOME/bin-gnu:$H:$PATH \
        make -j8 ARCH=mips CROSS_COMPILE=mipsel-linux- uzImage.bin

 2) 検証定数を生成して 2 回目のビルド
      bash ~/atomcam71/instrument/refresh-tail.sh
      cd $K && PATH=$HOME/bin-gnu:$H:$PATH \
        make -j8 ARCH=mips CROSS_COMPILE=mipsel-linux- uzImage.bin
    ※ ledprobe_tail.h は compressed/ の head.S と decompress.c からしか
      読まれないので、2 回目は head.o/decompress.o の再ビルドと vmlinuz の
      再リンクだけで終わり、vmlinux.bin のサイズは変わらない (1 回で収束)。
      収束の確認: 2 回目の後も compressed/vmlinux.bin のサイズが
      ledprobe_tail.h のコメントと一致すること。

 3) buildroot がカーネルを再展開したらパッチは消える。その場合は
      ~/thingino-firmware/dl/linux/git/ 側の同じファイルにも当てること。

 4) 元に戻す:  bash ~/atomcam71/instrument/revert.sh
==============================================
EOT
