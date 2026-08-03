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
  - 解凍後 vmlinux.bin は **12,128,736 B = 0xB90BE0** → 0x80100000 + 0xB90BE0 = **0x80C90BE0** まで伸びる
    (旧記載の ≈0x80C87C00 は誤り)
  - **v1 の Load/Entry 0x80c90000 は 0x80C90BE0 の内側 = zboot stub が自分自身を上書きする致命的欠陥。**
    v1 の沈黙はこれ単独で説明できる (v2 の沈黙とは別現象)
  - v2 の Load/Entry 0x80ca0000 は正しい。`readelf -h $K/vmlinuz` → Entry 0x80ca0000 /
    LOAD FileSiz 0x42eb00 MemSiz 0x930b10。余裕は 0xF420 (62,496 B) しかない
- **7.1 は u-boot の bootargs を一切見ない**: `CONFIG_MIPS_CMDLINE_FROM_DTB=y`。
  do_sdstart が強制する `mem=64M@0x0 ... rdinit=/linuxrc` は 7.1 に無効 (`/linuxrc` 不在は無関係)
- **DTB 仮説は棄却済み**: `__dtb_start == __dtb_thingino_t31_begin` (唯一の builtin DTB)、
  `ingenic,t31` は `arch/mips/generic/board-ingenic.c` の `ingenic_of_match[]` に存在

## 安全: sdupdate は NOR を焼くが、リセットボタンで gate されている

- `do_sdupdate` @0x80109344 は先頭で `gpio_request(51,"sdupgrade") → gpio_direction_input(51) →
  gpio_get_value(51)&1` を見て、押されていなければ `beqz s0,0x801098b0` で
  **SD 読み込み + NOR 書き込みパスを丸ごと飛ばす**
- したがって SD に何 MB のファイルを置いても、**リセットボタンを押さずに通電する限り NOR は書かれない**
- ペイロードに `FWGRADEUP` 文字列を含めないこと (更新フラグとして解釈されうる)

## 実機診断 (UART なしでの切り分け)

- initramfs の init が SD へ `boot71.log` を全ステップ書いて sync (KS-2 の判定材料)
- LED プローブ `ledprobe` (initramfs 組込): devtmpfs 直後に黄+青点灯 / SD 検出で黄消灯 / switch_root 直前に青消灯
- ベアメタル blink: **`~/atomcam71/blink3/` を使う**。`~/atomcam71/blink/`(v1) は GPIO アドレスが誤りで廃止
- LED: 黄=GPIO38/PB6、青=GPIO39/PB7、**active-low**。
  **GPIO レジスタ: bank B base = phys 0x10011000 / KSEG1 0xB0011000。バンクストライドは 0x1000 (0x100 ではない)**
  INTC=0xB0011018 / MSKS=0xB0011024 / PAT1C=0xB0011038(出力) / PAT0S=0xB0011044(HIGH=消灯) / PAT0C=0xB0011048(LOW=点灯)
  - 一次証拠(実機 NOR の u-boot, mtd0.bin): `misc_init_r` @0x8012b330 が
    `gpio_request(38,"yellow_gpio"); gpio_direction_output(38,0)` → 黄点灯、
    `gpio_request(39,"blue_gpio"); gpio_direction_output(39,1)` → 青消灯 (= active-low が確定)。
    アドレス計算は @0x80112de8 の `srl v1,a0,0x5 / lui v0,0xb / addiu v0,v0,16 / addu v0,v1,v0 / sll v0,v0,0xc`
    = `(0xb0010 + (gpio>>5)) << 12`
  - ⚠️ 2026-08-03 まで本ファイルに `bank B base 0x10010100` と誤記されており、
    その誤りが `blink/blink.c` と `initramfs_root/bin/ledprobe`(mmap 0x10010000 len 4096 で PORT B に到達不能)に伝播。
    **8/1・8/3 のベアメタル/LED プローブ実機テストはすべて PORT A に書いていた = 情報量ゼロの空実験だった**
  - 純正 bootcmd 冒頭の `mw 0xb0011134 0x300 1` も PORT B の PXPAT1S (bit8,9 = GPIO40,41) であり、
    ストライド 0x1000 を裏づける独立証拠
- その他 GPIO: mmc_cd=59 / mmc_power=48(active-low) / wlan=57 / reset ボタン=51
- ~~症状の読み方: 黄常灯のみ=NOR 純正が起動(sdstart 失敗)~~ ← **この判定則は無効。使用禁止**
- 症状の読み方(改訂): 黄常灯は (1) NOR フォールバック / (2) ペイロードがハング /
  (3) ペイロードが LED を触れていない の3状態を区別できない。**判別子は「時間軸」**:
  - 電源投入から数秒以内に LED が変化 → ペイロードが走っている
  - 20〜40 秒後に LED が変化しカメラがネットワークに出る → NOR 純正 3.10 にフォールバック
  - 90 秒何も起きない → ハンドオフ前で停止

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
- `.probeL` = blink3 の 4,385,600B 版(.71v2 と幾何学的に完全一致) / `.probeS` = 352B 版 / `.blinkv1` = 廃止した v1 プローブ
- `rootfs_71.squashfs` — 7.1 用 rootfs (switch_root 先)
- `wpa_supplicant.conf` — P8 (WiFi) 用に配置済み
- 既存ファイルは消さない。退避はリネームで行う
- **既知の正常状態に戻す**: `cp /mnt/sd/factory_t31_ZMC6tiIDQN.310 /mnt/sd/factory_t31_ZMC6tiIDQN && sync`
  (md5 `5ca130feb23e2331b31a9ccb379d1c70`。`~/atomcam_tools/target/` と sd-backup の同名ファイルと3者一致)

## SD の書き込み規律 (必須)

- SD は lll-legacy 直挿し。udev ルール(ラベル `ATOMCAM` 基準)で `/mnt/sd` に自動マウントされる
  (`/etc/udev/rules.d/99-atomcam-sd.rules`、設定スクリプトは `~/setup-sd-automount.sh`)
- lll-legacy には root が無く `umount /mnt/sd` は失敗する。**抜く直前に必ず `sync`**
  (fsck.fat が dirty bit を検出済み。rw マウントのまま抜かれている)
- 「マウント経由の md5 が一致」は媒体到達の証明にならない。生読み検証は
  `docker run --rm --user 0 --privileged --device=/dev/sdg:/dev/sdg ... blockdev --flushbufs /dev/sdg; dd ...`
- ルートディレクトリは cluster 2 → 35 の2クラスタに断片化。新規ファイルの dirent 位置は生読みで確認する
- カードリーダーは相性がある。Anker PowerExpand / GL3224 系は `Media removed, stopped polling` で
  カードを検出できなかった。**Realtek USB3.0 Card Reader (056e:800e) で動作**

## ★起動チェーンの健全性は実機で確定した (2026-08-03)

blink3 の probeL(4,385,600B、`.71v2` と同一ジオメトリ)を実機で通電し、
**「黄+青の同時点灯 → 黄と青の交互点滅」を観測**した。これにより以下が実証された:

1. **ハンドオフ成功** — 両点灯は純正 u-boot が作れない状態(`misc_init_r` は黄=点灯/青=消灯にする)
2. **4.38MB が1バイトも欠けず届く** — 交互点滅 = payload 内2箇所のマジック
   (offset 0x200000 の `0xA5A5C0DE` と 末尾-16 の `0x5A5A1234`)が両方無傷
3. したがって **sdstart の FAT 読み / uImage 6検査 / bootm の 4.38MB memmove / 制御移譲は全て健全**。
   1984K 制限も 5MB 制限も無関係だった

→ **残る容疑者は 7.1 の vmlinuz(zboot stub + LZMA カーネル)本体のみ。**

- **v1 の沈黙は原因確定**: load/entry 0x80c90000 が解凍後 vmlinux(〜0x80C90BE0)の内側 → stub 自壊
- 棄却済みの仮説: メモリ配置の衝突 / LZMA ヒープのペイロード踏み潰し / SD 上のイメージ破損 /
  DTB 不在・誤選択 / bootargs 上書き / bootm overwrite

## LED 計装イメージ (instr-v2)

**`CONFIG_DEBUG_ZBOOT` が未設定**のため `puts/puthex/putc` は `do {} while(0)` に潰れ、
`error()` は**無出力の while(1)** だった。さらに `decompress.c` は `__decompress()` の戻り値を
捨てていた。つまり「破損検出」「無音の失敗」「本当のハング」が全部同じ症状に潰れていた。
これを LED で分解するのが計装イメージ。

- 資材: `~/atomcam71/instrument/`(ledprobe.h + 0001〜0004 パッチ + apply.sh/revert.sh + **pristine/**)
- 成果物 md5 `c35a6adbaa8927b33292c7bad86767af` (4,389,616 B、`.71v3` として SD に併置)
- **文法**: 進捗 S(n) = 青が枠(点きっぱなし)で黄が n 回点滅・一度きり /
  異常 E(n) = 黄が枠で青が n 回点滅・**永久に繰り返す**
  - ラッチに「青のみ」(奇数段)と「両方」(偶数段)だけを使う。どちらも u-boot には作れない状態。
    「黄のみ」= u-boot 平常状態、「消灯」= 電源断と区別できないので使わない
- 段階: S1=zboot エントリ(0x80CA0000) / S2=zboot BSS クリア後 / S3=decompress_kernel 復帰 /
  S4=kernel_entry(0x8095F0C0) / S5=kernel head.S 完走 / S6=start_kernel(0x80BD1778)
- 異常: E1=イメージ末尾4B不一致(DRAM に届いていない) / E2=LZMA が error() を呼んだ /
  E3=`__decompress()` が黙って非ゼロ復帰 / E4=解凍成功を主張したが入口ワードが違う
- ⚠️ **I-cache の罠**: u-boot は 0x800F9800〜0x80139800 に居り、解凍後カーネルが
  0x80100000〜0x80139800 を上書きする。`decompress.c:127` に上流のまま
  `/* FIXME: should we flush cache here? */` が残っている。重なり領域への最初の実行は
  **S6 内の `jal ledp_c_dly`(0x80100400)**。よって S5 の後に点滅が見えないまま
  両点灯/消灯になった場合も **S6 には入っている**と読む
- 元に戻す: `.orig` からのコピーバック(`~/atomcam71/instrument/pristine/` にも保存)。
  `revert.sh` の `patch -R` は git 管理外ツリーで半端に失敗しうるので `.orig` の方が安全
- 詳細な次アクションは `campaign-state.json` と最新ピン (`hx90:~/.cursor/session-pin/PIN.md`) を参照
