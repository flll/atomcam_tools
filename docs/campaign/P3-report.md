# フェーズ報告: P3 — thingino buildroot ビルド環境

## 結果

| 項目 | 値 |
|---|---|
| 状態 | 完了 |
| TODO | 16/16 |
| ビルド時間 | 16分15秒（975s） |
| 実機停止 | 0分（母艦 lll-legacy 上の作業） |

## 検証（実出力）

```
$ make BOARD=atom_cam2_t31x_gc2053_atbm6031
Build: master+d2bee44, 2026-07-31 05:19:50 +0000
Build Duration: 0:16:15 (975s)
Camera: atom_cam2_t31x_gc2053_atbm6031

$ ls -l output/master/atom_cam2_t31x_gc2053_atbm6031-3.10.14-uclibc/images/
   1511711  uImage
   5140480  rootfs.squashfs
   9633792  data.jffs2
  16777216  thingino-atom_cam2_t31x_gc2053_atbm6031.bin
    293349  u-boot-with-tpl-lzma.bin
     65536  u-boot-env.bin
```

**成功条件「uImage と rootfs.squashfs が生成される」を満たした。合格。**

パーティション配置も破綻していない（LOSS が全区画で 0）:

```
NAME    |   OFFSET |  PT_SIZE |  CONTENT |  ALIGNED |      END |  LOSS |
U_BOOT  |        0 |      320 |      286 |      320 |      320 |     0 |
UB_ENV  |      320 |       64 |       64 |       64 |      384 |     0 |
KERNEL  |      384 |     1536 |     1476 |     1536 |     1920 |     0 |
ROOTFS  |     1920 |     5056 |     5020 |     5056 |     6976 |     0 |
DATA    |     6976 |     9408 |     9408 |     9408 |    16384 |     0 |
```

## 発見

### 1. カーネルは環境変数1つで 7.1 に切り替わる（本フェーズ最大の収穫）

`thingino.mk` を読むと、カーネルの選択は `KERNEL_VERSION` で分岐しており、
7.1 系の分岐と対応ブランチが**既に本体に組み込まれている**:

```make
ifeq ($(KERNEL_VERSION_7),y)
        KERNEL_VERSION := 7.1-rc1
...
ifeq ($(KERNEL_VERSION),7.1-rc1)
        KERNEL_BRANCH := ingenic-7.1-rc1
```

さらに `Config.in` には kernel 7 のときバイナリ blob 側を外す分岐まである:

```
select BR2_PACKAGE_INGENIC_SDK if !KERNEL_VERSION_7
```

つまり `make BOARD=... KERNEL_VERSION=7.1-rc1` を渡すだけで 7.1 のビルドに入る。
**7.1 移行はビルドシステムの改造から始める必要がない。**

### 2. 7 系のブランチは `ingenic-7.1-rc1` 1本だけ

```
$ git ls-remote --heads https://github.com/gtxaspec/thingino-linux
... ingenic-7.1-rc1
... ingenic-t31 / ingenic-t31-4.4.94 / ingenic-t32-5.15.170 / ...
```

7.0 のブランチは存在しない。kernel.org 側でも 7.0 は stable にも longterm にも
残っていない（stable=7.1.5、longterm=6.18/6.12/6.6/6.1/5.15/5.10、参照日 2026-07-31）。
**到達目標を 7.1-rc1 に確定した。**

### 3. `install` が uutils 版でビルドが止まる

buildroot が既知バグを理由に uutils の `install` を明示的に弾く:

```
$ install --version → install (uutils coreutils) 0.8.0
support/dependencies/dependencies.sh:194 → exit 1
```

案内される `update-alternatives` は sudo が要るため、PATH シムで回避した:

```
$ ln -sf /usr/bin/gnuinstall ~/bin-gnu/install
$ PATH=$HOME/bin-gnu:$PATH install --version → install (GNU coreutils) 9.7
```

sudo 不要で、かつビルド全体が GNU install を使うので本来の意図とも一致する。
**以降のビルドは必ず `PATH=$HOME/bin-gnu:$PATH` を付けること。**

### 4. 生成イメージは NOR 前提。SD 起動には uImage/rootfs だけを抜く

`thingino-*.bin`（16MB）は NOR 全体に焼く前提の成果物。本キャンペーンは
**NOR を一切書かない**方針なので、この bin は使わない。
SD 起動経路に載せるのは `uImage` と `rootfs.squashfs` の2つ。

## 次フェーズへの申し送り

- 3.10.14 の成果物は P4 の**母艦**にそのまま使える（対照群としても機能する）
- 7.1 のビルドは出力先が `-7.1-rc1-uclibc` と別ディレクトリになるため、
  3.10 の成果物を壊さずに並行して持てる
- ツールチェーンが 7.1 側では gcc15 に切り替わる（3.10 側とは別物）
