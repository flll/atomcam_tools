# AGENTS.md — ATOMCam2 カーネル 7.1 化キャンペーン (C-L)

新しいエージェントはまずこれを読むこと。正本はこのリポジトリ (`lll-legacy:~/atomcam_tools`)。
進行状態は `campaign-state.json`(phaseIndex 等)、フェーズ報告は `docs/campaign/P*-report.md`。

## ゴールと絶対禁止

- ゴール: ATOMCam2 (Ingenic T31X + GC2053 + atbm6031) のカーネルを 3.10.14 → **7.1-rc1** (thingino 移植) に上げ、tailscale を最新化する。KS-2 = SD の `boot71.log` に 7.1 の uname + switch_root 到達が記録されること
- 映像(ISP/AVPU)は**非ゴール**(任意フェーズ P10-11)。7.1 到達自体が成果
- **絶対禁止**: NOR フラッシュへの書き込み / UART ハンダ付け / USB データ線改造。IO は SD スロットと電源 microUSB のみ
- git push しない(コミットは日本語・AI 著作権表記を入れない)

## マシン構成 (2026-08-03 更新)

- **lll-legacy**: ビルド・逆アセンブル・**SD カード読み書き**のすべてを行う正本マシン。
  SD 作業は 2026-08-03 に hx90 から移行済み(hx90 の H: はもう使わない)
- hx90 (Windows): ユーザーの操作端末。旧バックアップ `C:\Users\no5\atomcam-71\sd-backup-20260731\` は残置(正本は lll-legacy 側 `~/atomcam-backup/sd-backup-20260731/`)
- 実機テストはユーザーの手作業: SD をカメラへ→電源 ON→LED 目視/数分通電→SD を lll-legacy へ戻す

## ディレクトリ地図 (lll-legacy)

| パス | 内容 |
|---|---|
| `~/atomcam_tools` | campaign 正本 (state, docs, initramfs_71/ に修正の写し) |
| `~/thingino-firmware` | ビルドツリー (master)。BOARD=atom_cam2_t31x_gc2053_atbm6031 |
| `~/atomcam71/` | initramfs_root(init 正本)・initramfs_devnodes.txt・blink/(ベアメタルプローブ)・ledprobe |
| `~/atomcam-backup/20260731-p0/` | mtd0.bin 等 NOR 全パーティションのバックアップ (u-boot 逆アセンブルの素材) |
| `~/atomcam-backup/sd-backup-20260731/` | SD フルバックアップ正本 |
| `~/venv-cap` | capstone 入り venv (MIPS 逆アセンブル用。objdump は無い) |
| `~/bin-gnu` | GNU coreutils (ビルド時 PATH 先頭に必要) |

カーネルビルドディレクトリ `$K` = `~/thingino-firmware/output/master/atom_cam2_t31x_gc2053_atbm6031-7.1-rc1-uclibc/build/linux-92b684b3674ed0ea2bd0c96b6b151402b19fd666`

## SD 起動チェーン (u-boot 解析で確定済み)

- NOR の u-boot 環境変数: `bootdelay=0`、
  `bootcmd=mw 0xb0011134 0x300 1;sdstart;sdupdate;sf probe;sf read 0x80600000 0x40000 0x1F0000; bootm 0x80600000`
  → **sdstart は毎回自動実行**され、失敗すると黙って NOR の純正 3.10 にフォールバック(見た目: 黄色 LED 常灯)
- sdstart (do_sdstart @0x80108ee0、mtd0.bin の load addr = file offset + 0x800f9800):
  SD の FAT から `factory_t31_ZMC6tiIDQN` を **0x84000000** に読み(上限 **0x500000=5MB**)、以下を全部検査して `bootm 0x84000000`:
  1. magic 0x27051956 / 2. ih_arch=5(MIPS, off 0x1d) / 3. ih_type=2(kernel, off 0x1e) /
  4. ヘッダ CRC / 5. **ファイルサイズ == ih_size+0x40 (完全一致)** / 6. データ CRC
- 純正 3.10 の枠: 解凍先 0x80100000〜ロード元 0x80600000 (5MB)。7.1 の解凍後 12MB は溢れる →
  **自己解凍 uzImage (C=none の uImage が stub+LZMA を包む)** で回避。stub のロード先はカーネル末尾より上に置く
  (v2: Load/Entry 0x80ca0000。解凍後 vmlinux 末尾 ≈0x80C87C00 なので重ならない)

## 実機診断 (UART なしでの切り分け)

- initramfs の init が SD へ `boot71.log` を全ステップ書いて sync (KS-2 の判定材料)
- LED プローブ `ledprobe` (initramfs 組込): devtmpfs 直後に黄+青点灯 / SD 検出で黄消灯 / switch_root 直前に青消灯
- ベアメタル blink (`~/atomcam71/blink/`): 224B の MIPS コード。uImage ヘッダを本番と同一(comp=0, load=entry=0x80ca0000)にして sdstart→bootm の受け渡しだけを検証
- LED: 黄=GPIO38/PB6、青=GPIO39/PB7、**active-low**。GPIO レジスタ: bank B base 0x10010100、
  INTC=+0x18 / MSKS=+0x24 / PAT1C=+0x38(出力) / PAT0S=+0x44(消灯) / PAT0C=+0x48(点灯)
- その他 GPIO: mmc_cd=59 / mmc_power=48(active-low) / wlan=57 / reset ボタン=51
- 症状の読み方: **黄常灯のみ=NOR 純正が起動(sdstart 失敗)** / 黄+青点きっぱなし=7.1 生存だが SD 検出失敗 / 点いてすぐ消灯=switch_root 到達見込み

## ビルドの罠 (全部実際に踏んだ)

1. thingino の make ラッパは uImage が存在するとスキップする。`.stamp_*` を消しても **uzImage.bin は再生成されない**
2. buildroot の `linux-rebuild` も uzImage.bin を作らない (デフォルトターゲット外)
3. **正解**: `cd $K && PATH=$HOME/bin-gnu:$O/host/bin:$PATH make ARCH=mips CROSS_COMPILE=mipsel-linux- uzImage.bin`
4. DTS は 2 箇所に同じパッチが要る: `$K/arch/mips/boot/dts/ingenic/` と `~/thingino-firmware/dl/linux/git/arch/mips/boot/dts/ingenic/` (後者が再展開元)
5. initramfs は CONFIG_INITRAMFS_SOURCE=`~/atomcam71/initramfs_root` + devnodes。init や bin/* を変えたら uzImage.bin を作り直す
6. カーネル config の要点: CONFIG_MMC_JZ4740=y / BUILTIN_DTB(thingino-t31) / KERNEL_LZMA / DEVMEM=y / GPIO_SYSFS=y / CMDLINE "earlycon"
7. DTB の mmc@13450000 には `broken-cd;` を入れてある (実機の cd-gpio は 59 だが polling で回避)
8. 静的ツールのクロスビルド: `$O/host/bin/mipsel-linux-gcc -static -Os` (busybox に devmem は無い)
9. capstone は venv (`source ~/venv-cap/bin/activate`)。pip 直はexternally-managed で失敗する

## SD 上のファイル (factory_* の運用)

- `factory_t31_ZMC6tiIDQN` — u-boot が起動する現物 (差し替えて実験する)
- `.310` = 純正 3.10 / `.71v1` = v1(load 0x80C90000) / `.71v2` = v2(broken-cd+ledprobe, load 0x80ca0000, md5 f55a3a40...)
- `rootfs_71.squashfs` — 7.1 用 rootfs (switch_root 先)
- `wpa_supplicant.conf` — P8 (WiFi) 用に配置済み
- 既存ファイルは消さない。退避はリネームで行う

## 現在地 (2026-08-03 時点)

- v1・v2 とも実機で完全沈黙 (boot71.log 書かれず・LED 変化なし)
- ベアメタル blink も点滅せず**黄常灯のみ** → sdstart が bootm まで到達していない疑い濃厚
  (v2/blink はヘッダ検査を全部通るはずなのに蹴られている → sdstart 実行時の SD 読み取り・
  FAT 解釈・sdupdate の干渉・`mw 0xb0011134` の意味などが次の調査点)
- 詳細な次アクションは `campaign-state.json` と最新ピン (`hx90:~/.cursor/session-pin/PIN.md`) を参照
