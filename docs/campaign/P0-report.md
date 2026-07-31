# フェーズ報告: P0 — 全計測と MTD 全バックアップ

## 結果

| 項目 | 値 |
|---|---|
| 状態 | 完了 |
| TODO | 18/18 |
| 所要 | 1セッション |
| 実機停止 | 0分（読み出しのみ・実機を一切変更していない） |

## 検証（実出力）

### MTD 全パーティションのダンプ（2回読んで md5 一致）

```
$ for i in 0..7: dd if=/dev/mtd${i}ro → mtdN.bin / verifyN.bin
  mtd0: MATCH  bbf7a075d21ea32e3fe0c35ca9a0bbdf
  mtd1: MATCH  0acbdba08bb52511be195cdd26d20294
  mtd2: MATCH  1d530ab54953a8922214db964b9d59cb
  mtd3: MATCH  e69f297ffeab4255e220428c106efd7d
  mtd4: MATCH  0acbdba08bb52511be195cdd26d20294
  mtd5: MATCH  e69f297ffeab4255e220428c106efd7d
  mtd6: MATCH  28a43395106d2e3c4f77e74b073d2914
  mtd7: MATCH  ecb99e6ffea7be1e5419350f725da86b
--- 一致 8 / 不一致 0 ---

$ cat mtd*.bin | wc -c
16777216
```

**成功条件との対比**: 「8パーティションを2回読んで md5 全一致」「合計 16,777,216 バイト」の
両方を満たした。**合格。**

### GSM 二重化の往復検証

```
$ gcloud secrets create atomcam-nor-identity --project=lll-fish
Created version [1] of the secret [atomcam-nor-identity].

$ gcloud secrets versions access latest --secret=atomcam-nor-identity --out-file=restored.tar.gz
$ tar xzf restored.tar.gz && md5sum mtd6.bin mtd7.bin
28a43395106d2e3c4f77e74b073d2914 *mtd6.bin     ← 実機由来と一致
ecb99e6ffea7be1e5419350f725da86b *mtd7.bin     ← 実機由来と一致
```

**復元まで検証済み。**「バックアップした」ではなく「戻せることを確認した」状態。

### ベースライン計測（P7 メモリゲートの基準）

```
$ cat /proc/cmdline
console=ttyS1,115200n8 mem=92M@0x0 rmem=36M@0x5c00000 rdinit=/init
mtdparts=jz_sfc:256K(boot),1984K(kernel),3904K(rootfs),3904K(app),1984K(kback),3904K(aback),384K(cfg),64K(para)

$ grep -E "^(MemTotal|MemFree|Buffers|Cached)" /proc/meminfo
MemTotal:          87708 kB
MemFree:            3100 kB
Buffers:            5332 kB
Cached:            37224 kB
                                    ← MemAvailable は存在しない

$ uptime
 11:48:08 up 21:10,  load average: 2.43, 2.24, 2.00

$ ls /sys/class/udc
dwc2

$ uname -a
Linux atomcam 3.10.14__isvp_swan_1.0__ #4 PREEMPT Fri Jul 3 11:12:14 UTC 2026 mips GNU/Linux
```

## 発見（プラン前提の修正が必要なもの）

### 1. `MemAvailable` が存在しない → **P7 のゲート指標を差し替える必要がある**

kernel 3.10 には `MemAvailable`（3.14 で導入）が無い。プランの P7 成功条件
「MemAvailable が 3.10 比 −8MB 以内」は**そのままでは比較不能**。

**代替指標**: `MemFree + Buffers + Cached` を使う。
現行ベースライン = 3100 + 5332 + 37224 = **45,656 kB**。
7.1 側でも同じ式で採り、差分で判定する（7.1 には MemAvailable があるが、
**比較は同一式で行う**）。

### 2. A/B 面が現用面と md5 完全一致 → **復旧経路がもう一段厚い**

- `mtd1`(kernel) と `mtd4`(kback) が同一: `0acbdba08bb52511be195cdd26d20294`
- `mtd3`(app) と `mtd5`(aback) が同一: `e69f297ffeab4255e220428c106efd7d`

純正のバックアップ面が**機内に無傷で存在**している。SD を抜く復旧に加えて、
NOR 内 A/B 切替という経路も理論上ある（ただし切替方法は未調査）。

### 3. UART は **ttyS1**（cmdline で確定）

`console=ttyS1,115200n8`。P6 で「カーネルは動いているのに別ポートを見ていて無音」
という最悪の誤診を回避できる。**P6 の探索コストが下がった。**

### 4. USB gadget（dwc2）が有効

`/sys/class/udc/dwc2` が存在。P12（WiFi）をクリティカルパスから外し、
`g_ether` で開発用の到達性を確保できる見込み。ただし
**USB-C にデータ線が結線されているかは未確認**（P6 の物理作業時に判明する）。

### 5. SD 起動構成を実物で確認

```
factory_t31_ZMC6tiIDQN   1,952,568 B   ← 純正 u-boot が SD から読むファクトリーブート
atom_root.squashfs       3,997,696 B
rootfs_hack.squashfs    62,808,064 B   ← switch_root 先
rootfs_hack.squashfs.bak 62,808,064 B
```

**プランの前提（SD を抜けば純正に戻る）を裏付ける物理的証拠。**

## 副産物（後続フェーズで使うデータ）

| 種類 | 保存先 | 使う場所 |
|---|---|---|
| NOR 全体イメージ（16MB, md5 `7c49c83d96d7889961452a4b21e525ad`） | `lll-legacy:~/atomcam-backup/20260731-p0/full-nor-16mb.bin` | 全フェーズの最終復旧手段 |
| パーティション個別（mtd0-7.bin） | 同上 | 部分復旧・解析 |
| **機体固有値（cfg/para）** | **GSM `atomcam-nor-identity`（lll-fish）** | 再生成不能。多重化必須 |
| メモリベースライン 45,656 kB | 本レポート + campaign-state.json | **P7 のゲート判定** |
| cmdline（rmem 配置・console） | 同上 | P7 の DT / bootargs 設計 |

## 次フェーズへの申し送り

- **P7 の成功条件を「MemFree+Buffers+Cached の差分」に読み替える**こと（プラン正本は
  編集禁止のため、この申し送りで上書きする）
- P1（復旧実証）は **WAN 遮断下で実施**すること。SD を抜いて純正起動すると
  クラウド経由で NOR を自動更新する恐れがある。P0 のバックアップは完了済みなので前提は満たした
- P6 で UART を当てる際は **ttyS1** を見る
- 未確認: USB-C のデータ線結線 / `factory_t31` が任意の uImage を受けるか
