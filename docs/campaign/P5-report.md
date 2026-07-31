# フェーズ報告: P5 — 7.1-rc1 のビルド成立

## 結果

| 項目 | 値 |
|---|---|
| 状態 | 完了 |
| ビルド試行 | 10ラウンド(71a〜71m) |
| 実機停止 | 0分 |

## 検証(実出力)

```
$ file images/uImage
u-boot legacy uImage, Linux-7.1.0-rc1, Linux/MIPS, OS Kernel Image (lzma),
3,857,821 bytes, Load Address: 0x80100000, Entry Point: 0x80964BA0

$ strings vmlinux | grep -m1 "Linux version"
Linux version 7.1.0-rc1 (lll@lll-legacy) (mipsel-linux-gcc 15.3.0)

$ unsquashfs -l images/rootfs.squashfs | grep atbm
usr/lib/modules/7.1.0-rc1/updates/hal_apollo/atbm6031.ko   ← WiFi ドライバ同梱
usr/lib/firmware/atbm6031_fw.bin
```

rootfs.squashfs 4,755,456 B。**カーネル・rootfs・WiFi ドライバの3点が 7.1.0-rc1 で揃った。**

## 直したもの(時系列)

| # | エラー | 原因 | 対処 |
|---|---|---|---|
| 1 | wireguard-linux-compat がビルド不能 | make変数とKconfigの desync(KERNEL_VERSION_3=y のまま) | user/<cam>/local.fragment で DEV_PACKAGES→DEV_EXPERIMENTAL→KERNEL_VERSION_7 の3段を開栓 |
| 2 | compat-2.6.h: No such file | 新kbuildで外部モジュールの $(src) が相対化 | k-dir を KBUILD_EXTMOD 基準に |
| 3 | asm/unaligned.h 無し | 6.12 で linux/unaligned.h へ移動 | 両対応 shim ヘッダ生成 |
| 4 | wdev->mtx / del_timer / from_timer | 5.12 wiphyロック化・6.15/6.16 timer改名 | version ガード付き互換定義 |
| 5 | cfg80211_new_sta 型不一致 | 7.x で wireless_dev 引数化 | 同名マクロが宣言を壊す失敗を経て、別名マクロ+呼び出し側置換 |
| 6 | cfg80211_ops 13関数の型不一致 | 13年分のシグネチャ変更(link_id 追加等) | ops テーブル直前にアダプタ層を自動挿入 |
| 7 | mlme.c の3構造体 | rx_assoc_resp_data 化・assoc_failure 化・bss→ap_addr | 7.1ヘッダを実読して version 分岐を挿入 |
| 8 | MIN_ACTION_SIZE / spurious_frame / amsdu | 関数マクロ化・link_id/mesh_control 追加 | 定数供給+引数マクロ |
| 9 | net/ipx.h | IPX がカーネルから削除(未使用 include) | version ガードで除去 |
| 10 | prandom_u32 / skb_frag bv_* / MODULE_IMPORT_NS | 6.1 削除・6.x 構造変更・6.13 文字列化 | 互換 define+アクセサ化 |
| 11 | gcc15 厳格化 3件 | 元からの雑コード(キャスト欠落・return欠落) | キャスト+return 挿入 |

## 実装の形

全修正は package/wifi-atbm6031/ の POST_EXTRACT フック
(`fix-modern-kernel.py` + .mk 内 sed/printf)として実装。

- **上流ソース無改変**: git 管理された thingino リポジトリ内で完結し、展開の度に自動適用
- **冪等**: 適用済みならスキップ。バイト置換なので CRLF ソースでも安全
- **全カーネル両対応**: すべて LINUX_VERSION_CODE ガード付きで、3.10 ビルドでは無変化

## 教訓

1. **make 変数と Kconfig は別の世界**。KERNEL_VERSION=7.1-rc1 はソース取得にだけ効き、
   パッケージ選択は KERNEL_VERSION_7(Kconfig)が支配する。片方だけ変えると
   「7.1 カーネル + 3.10 前提ユーザーランド」という desync が起きる
2. **-include されるヘッダに同名関数マクロを置いてはいけない**。カーネルヘッダの
   宣言までマクロ展開されて構文が壊れる。別名マクロ+呼び出し側置換が正しい
3. **文字列検索は前方宣言に先にヒットする**。定義本体は2番目の出現
4. **pkill -f のパターンに自分のコマンドラインが含まれると自爆する**
5. エラー種の推移は 1→1→3→17→3→1→7→3→1→0。**山(ops 一括)を越えたら単調減少**で、
   ベンダドライバの構造自体は 7.1 と矛盾していなかった(KS-1 の判定どおり)

## 次フェーズへの申し送り

- uImage は Load 0x80100000 / Entry 0x80964BA0。SD 起動経路(factory_t31)に載せるのは P6
- rootfs に modules/3.10.14 の空ディレクトリが残る(mk のハードコード)。実害なし
- コンパイルが通っただけで**動作は未検証**。insmod 時の実挙動は P6(KS-2)以降で確認
