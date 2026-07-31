# フェーズ報告: P2 — KS-1 静的 API 依存監査（実機不要）

## 結果

| 項目 | 値 |
|---|---|
| 状態 | 完了 |
| キルスイッチ | **KS-1 合格** |
| TODO | 22/22 |
| 実機停止 | 0分（実機に一切触れていない） |

## 監査対象

`opensensor/open-tx-isp` を thingino のパッケージ定義が固定している
コミットで取得して検査した（**buildroot が実際に使うのと同一のコード**）。

```
$ cat package/open-tx-isp/open-tx-isp.mk
OPEN_TX_ISP_VERSION = d783ec7ee553c821999acf49f4ca7b1e9a187ab4

$ git checkout d783ec7ee553c821999acf49f4ca7b1e9a187ab4 && git log --oneline -1
d783ec7e Check pt
```

## 判定の考え方

キルスイッチの成否は「**mainline 7.1 に等価物が存在しない API が中核に何件あるか**」で決める。
0件なら移植は機械的な作業に収まり、1件でもあれば代替の設計から始めることになる。

## 検査結果（実出力）

```
videobuf v1 (files)              0     ← 7.1 で完全削除。あれば致命的
videobuf2 (files)                6     ← 現行 API。7.1 にもある
bootmem/memblock (hits)          0     ← 独自の予約メモリ確保なし
cache direct (hits)              0     ← dma_cache_wback 等の直叩きなし
CPM direct (hits)                0     ← クロック管理の直叩きなし
create_proc_entry (hits)         6     ← 後述。偽陽性
proc/jz refs (hits)             47
init_timer (hits)                0     ← 7.1 で削除済み API。不使用
get_user_pages (hits)            0     ← シグネチャ変更が多い API。不使用
TOTAL .c/.h files               44
```

### 赤判定カテゴリはすべて 0件

`videobuf` v1・`bootmem` 系アロケータ・キャッシュ直叩き・CPM 直叩きは
**mainline に等価物がないか、あっても意味論が変わっている**ため、使われていれば
そこで設計をやり直す必要があった。**4カテゴリすべて 0件。**

バッファ管理は現行の `videobuf2` を 6ファイルで使っている（うち t31 は 3ファイル）:

```
./driver/t31/tx_isp_v4l2.c
./driver/t31/tx_isp_subdev.c
./driver/t31/tx_isp_fs.c
（他は t23/t40/t41 の recovered 系で、本機では未使用）
```

### `create_proc_entry` 6件は偽陽性

`create_proc_entry()` は mainline で削除済みのため一度は赤判定にしたが、
実物を見ると**すべて構造体のフィールド名**だった:

```
./driver/t31/tx_isp_subdev_mgmt.c:31:    bool create_proc_entry;
./driver/t31/tx_isp_subdev_mgmt.c:129:        .create_proc_entry = true,
（以下同様に 4件）
```

実際に呼ばれているのは現行 API の `proc_create` で、t31 では
`tx_isp_proc.c` に 11件・`tx_isp_vic.c` に 1件。**削除済み API の使用は 0件。**

### `/proc/jz` 47件はデバッグ出力口に集中

```
     22 ./driver/t31/tx_isp_proc.c      ← proc インタフェースの実装そのもの
     10 ./driver/t31/tx_isp_subdev.c
      7 ./driver/t31/tx_isp_vic.c
      その他 t40/t41/t23（本機では未使用）
```

映像パスの動作に必要な依存ではなく**状態を覗くための出口**なので、
7.1 で `/proc` の作法が変わっても debugfs へ移すだけで済む。**移植の障害にならない。**

### センサは gc2053 単独で、本体と結線済み

```
$ ls sensor-src/t31/ && wc -l sensor-src/t31/*.c
gc2053.c
2196 sensor-src/t31/gc2053.c
```

実機のセンサ（gc2053）**そのもの**のドライバが、t31 向けに唯一存在する。
`#include <tx_isp_common.h>` で本体と結線済みで、センサ側の新規実装は不要。

## KS-1 判定

**合格。** 中核（t31）に mainline 等価物なしの API は 0件。
open-tx-isp は現行 API の上に書かれており、7.1 への移植は
「API の置き換え」ではなく「ビルドと挙動の追い込み」の問題に落ちる。

ただし**静的監査は「動く」ことを保証しない。** 実際に動くかは
P5（KS-2: 3.10.14 実機で open-tx-isp を検証）で決着する。本フェーズが示したのは
**そこへ進んでよい**ということだけ。

## 発見

1. **監査コマンドの偽の合格**: zsh で `--include=*.c` が展開されず全カテゴリ 0件という
   「完璧な結果」が出た。0 が並んだら**まず検査自体を疑う**。クォートして採り直したところ
   `videobuf2` 6件・`proc/jz` 47件が現れた
2. **`create_proc_entry` は API 名と同じフィールド名**で 6件の偽陽性。
   grep の件数だけで赤判定してはいけない。実物を見て初めて安全と判った
3. thingino が open-tx-isp のコミットを固定しているので、**監査した対象と
   ビルドされる対象が一致する**ことを保証できた

## 次フェーズへの申し送り

- P5（KS-2）で見るのは ioctl の**振る舞いの一致**。libimp.so を無改造で動かせるかが本番
- t40/t41/t23 の `recovered` 系ファイルは本機では未使用。ビルド対象から外れることを P3 で確認する
- `tx_isp_proc.c` は 7.1 で debugfs へ移す候補（P9 の作業項目に追加）
