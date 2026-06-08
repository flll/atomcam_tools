# システムアーキテクチャ

atomcam_tools の内部構成・起動シーケンス・スクリプト一覧。

[ビルドガイドに戻る](../../build.md) | [README](../../README.md)

## システム構成

### ハードウェア仕様

| 項目 | 仕様 |
|------|------|
| **SoC** | Ingenic T31 SoC |
| **CPU** | MIPS32R5 I$32K/D$32K/L2$128K |
| **Kernel** | Linux 3.10.14 MIPSEL |

### AtomCam内部環境

このイメージでAtomCamを起動すると：

- **glibcベース**: MIPSEL版Linux環境が起動
- **chroot構成**: `/atom`ディレクトリ以下に本来のAtomCamシステム
- **監獄化**: chrootで本来システムを隔離

## 起動シーケンス

### 1. U-Boot
- カーネル内蔵initramfsの`/init`ディレクトリに配置

### 2. Initramfs
- 内容: `initramfs_skeleton/`ディレクトリに格納
- カーネル起動時に`/init`実行を設定

### 3. ツール更新
- 必要に応じて更新処理実行

### 4. ルートファイルシステム切り替え
- SD-Card上の`rootfs_hack.squashfs`をルートにswitch_root
- remount処理実行
- `/sbin/init（busybox）`起動

## rootfs_hack.squashfs 詳細

### 構成
`configs/atomcam_defconfig`設定でビルドされたイメージに`overlay_rootfs`を重ねて構成

### 起動プロセス

1. **初期化**
   - `/sbin/init`が`inittab`に従って`/etc/init.d/rcS`起動

2. **スクリプト実行**
   - `rcS`が`/etc/init.d/S*`を順番に実行

3. **完了サイン**
   - **シリアル接続**: gettyでログインプロンプト表示
   - **AtomCam**: 背面LED青点滅→青点灯でSSHログイン可能

## 重要な初期化スクリプト

### `/etc/init.d/S16fwupdate`
- AtomCamファームウェアアップデートシーケンスの代行処理

### `/etc/init.d/S20mountfs`
- overlayfs未対応のため、bind mountでファイル/フォルダー配置を入れ替え

### `/etc/init.d/S61atomcam`
- `/atom/`以下に本来のATOMCamシステムをmount
- 共通アクセス可能なmount-point設定
- chrootで`/atom`の`/tmp/system/bin/atom_init.sh`呼び出し

> **ここまではglibcの世界で動作**

### `/atom/tmp/system/bin/atom_init.sh`
- 本来のAtomCam初期化シーケンス実行
- **ここからuClibcの環境**
- iCamera_app実行時に`libcallback.so`介在でパッチ適用
- WebHook用ログを名前付きFIFOファイル（`/var/run/atomapp`）出力
- **注意**: ウォッチドッグ起動のため、assist・iCamera_appは停止不可
- **機能**: 認識機能等はクラウドから動的読み込み実行

---

## システムスクリプト詳細

### コマンド置き換えスクリプト

#### `/atom/bin/mv`, `/atom/bin/rm`
- **目的**: AtomCamのiCloud_app動作を拡張
- **rm**: 動体検知クラウド送信後の削除処理
- **mv**: 1分毎のSD-Card記録ファイル移動処理
- **機能**: NAS記録・WebHookイベント送信

### システム制御スクリプト

#### `/scripts/cmd`
- iCamera_app内部パラメータ・動作変更のラッパーコマンド

#### `/scripts/cruise.sh`
- AtomSwingクルーズ動作実行

#### `/scripts/hack_ini_reconfig.sh`
- バージョンアップ時のhack_ini互換性処理

#### `/scripts/health_check.sh`
- 定期的ネットワーク健全性チェック

#### `/scripts/lighttpd.sh`
- WebUI lighttpd起動処理・認証切り替え

#### `/scripts/memory_check.sh`
- 定期的メモリー状態ログ記録

#### `/scripts/motor_init`
- AtomSwingモーター初期位置動作

#### `/scripts/network_init.sh`
- ネットワーク接続初期化

#### `/scripts/reboot.sh`
- WebUI定期リブート設定のcrontab実行
- 同期リブート実行

#### `/scripts/remove_old.sh`
- 指定時間経過録画データ削除

#### `/scripts/rtspserver.sh`
- v4l2rtspserver on/off制御
- init.d/S58rtspserver・WebUI RTSPから呼び出し

#### `/scripts/samba.sh`
- **Samba起動/終了**制御

#### `/scripts/set_crontab.sh`
- `reboot.sh`・`timelapse.sh`のcrontab時刻設定

#### `/scripts/set_icamera_config.sh`
- `iCamera_app`起動直後の必須設定値処理

#### `/scripts/timelapse.sh`
- タイムラプス開始処理・終了時ファイル処理

#### `/scripts/webcmd.sh`
- `/var/www/cgi-bin/exec.cgi`から名前付きFIFO経由コマンド実行
- **www-data**アカウント制限対応の安全実行構造

#### `/scripts/webhook.sh`
- iCamera_appログ受信・WebHookイベント処理
- 名前付きFIFO経由ログ受信・curl POST送信

### WebUI CGIスクリプト

#### `/var/www/cgi-bin/cmd.cgi`
- WebUIコマンドを名前付きパイプ経由でwebcmd.shに転送

#### `/var/www/cgi-bin/get_jpeg.cgi`
- WebUI表示用JPEG画像取得

#### `/var/www/cgi-bin/hack_ini.cgi`
- WebUI設定値の取得・設定処理

#### `/var/www/cgi-bin/hello.cgi`
- モバイルアプリアクセス要求応答

#### `/var/www/cgi-bin/video_isp.cgi`
- カメラ設定詳細項目操作

#### `/var/www/cgi-bin/watermark.cgi`
- システム設定ロゴ設定処理

---
