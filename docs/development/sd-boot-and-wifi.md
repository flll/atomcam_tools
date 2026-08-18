# SD なし起動と Wi‑Fi の正本

ATOM Cam 2（本リポジトリの対象）について、SD カードの要否と秘密の置き場を固定する。
値（PSK 等）は書かない。キー名とパスだけ。

## 起動

純正 u-boot は NOR（SPI フラッシュ）にある。SD 第1パーティションの
`factory_t31_ZMC6tiIDQN`（uImage）が読めるとそれを起動し、hack の
`rootfs_hack.squashfs` へ入る。読めない／カードが無いと **NOR の公式 OS にフォールバック**する。

| 何をしたいか | SD |
|---|---|
| 公式カメラ（映像・公式アプリ） | 不要（録画や OTA 用に挿すことはある） |
| hack（WebUI / SSH / Tailscale / ログ画面） | 必須（`factory_t31_ZMC6tiIDQN` + `rootfs_hack.squashfs`） |

NOR は無改変が方針。カードを抜けば純正起動、という復旧の前提は
[P6-sd-deploy.md](../campaign/P6-sd-deploy.md) と同じ。

関連パーティション（実機 `/proc/mtd`）:

| mtd | name | 役割 |
|---|---|---|
| 0 | boot | u-boot |
| 1 | kernel | 公式カーネル |
| 2 | rootfs | 公式 rootfs |
| 3 | app | 公式 app（`/atom/system`） |
| 6 | cfg | 公式設定（jffs2）。Wi‑Fi の正本 |

## Wi‑Fi はどこにあるか

正本は **mtd6 `cfg`（jffs2）**。公式アプリが書いた `[NET]` の `ssid=` / `password=`。

hack 起動時（`overlay_rootfs/etc/init.d/S20mountfs`）:

1. SD に `configs`（ext2 1MB）が無ければ作る
2. loop mount して `/atom/configs` にする
3. `.user_config` 等が無ければ **mtd6 を `/atom/configs` へコピー**して埋める

`overlay_rootfs/scripts/network_init.sh`:

1. SD 直下に `wpa_supplicant.conf` があれば **それを優先**して `/configs/etc/wpa_supplicant.conf` にコピー
2. 無ければ `/atom/configs/.user_config` の `[NET]`、さらに無ければ `.wifissid` / `.wifipasswd`

つまり「公式内部から取れる」は正しい。空の `configs` なら mtd6 から取る。

## カード盗難

盗まれると読めるのは **SD 上のコピー**である。

- `/media/mmc/wpa_supplicant.conf`（hack が優先する二重コピー）
- `/media/mmc/configs`（ext2）内の `.user_config`

本体の公式 Wi‑Fi は mtd6 に残る。カード無しでも公式は家の AP に繋がる。
`wpa_supplicant.conf` だけ消しても `configs` が残れば漏洩は同じ。

hack.ini / `tailscaled.state` / CIFS 等の秘密は **hack が SD に置いたもの**で、公式フラッシュには無い。扱いの規則は [SECURITY.md](../../SECURITY.md)。
