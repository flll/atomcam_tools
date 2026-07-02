# リモートデプロイ (SD 抜き差しゼロ更新)

実機 (ATOMCam) へ SSH 経由でビルド成果物を転送し、再起動・起動確認・スモークテストまでを自動化する仕組み。
`initramfs_skeleton/init` の `/media/mmc/update/` 更新パス (サイズ検証付き) を利用する。

## 前提

- 実機に SSH 鍵でログインできること (`ssh root@<HOST>` がパスワードなしで通る)
- 実機側で atomcam_tools が稼働済みであること (初回導入は SD カード経由)

## 使い方

```bash
# フルデプロイ (atomcam_tools.zip) + スモークテスト
make deploy-test ATOMCAM_HOST=atomcam33

# デプロイのみ
make deploy ATOMCAM_HOST=atomcam33

# rootfs squashfs のみ高速更新
./scripts/deploy_remote.sh atomcam33 --squashfs-only

# 現在の状態確認 (バージョン / uptime / iCamera pid)
./scripts/deploy_remote.sh atomcam33 --status

# 直前のバックアップへロールバック
./scripts/deploy_remote.sh atomcam33 --rollback

# スモークテスト単体 (非破壊)
./scripts/smoke_test_remote.sh atomcam33 [期待バージョン]
```

`ATOMCAM_HOST` 未指定時は環境変数 `ATOMCAM_HOST`、それも無ければ `atomcam.local`。

## deploy_remote.sh の動作

1. `ssh cat /etc/atomhack.ver` で現行版を取得
2. 実機側バックアップ: `cp /media/mmc/rootfs_hack.squashfs{,.bak}`
3. 成果物を `scp` で `/media/mmc/update/` へ転送 → `sync; reboot`
4. 起動待ちポーリング: ping → ssh → `pidof iCamera_app`
   - squashfs のみ: タイムアウト 180 秒
   - フル zip: タイムアウト 300 秒 (factory_t31 同梱時は initramfs が 2 回再起動するため)
5. 再起動後の `/etc/atomhack.ver` を `configs/atomhack.ver` と比較して成否判定

stdout の最終行は機械可読な NDJSON 1 行:

```json
{"action":"deploy","host":"atomcam33","from":"2.5.18","to":"2.5.19","elapsed_s":142,"result":"ok"}
```

## exit code 表

| code | 意味 |
|------|------|
| 0 | 成功 (`--status` は iCamera 稼働中) |
| 1 | `--status` で SSH 不通 / iCamera 停止 |
| 10 | 転送失敗 (成果物なし・SSH 不通・scp 失敗・バックアップ失敗) |
| 20 | 起動タイムアウト |
| 30 | 再起動後のバージョン不一致 |

## smoke_test_remote.sh の検査ケース

| ケース | 検査 | fail 条件 |
|--------|------|-----------|
| version | `/etc/atomhack.ver` | 空 / 期待値と不一致 |
| icamera | `pidof iCamera_app` | プロセスなし |
| webui | `curl http://HOST/cgi-bin/hack_ini.cgi` | HTTP エラー |
| rtsp | `nc -z HOST 8554` (+ ffprobe があれば 1 フレーム) | RTSP=on なのに不通 |
| tailscale | `tailscale version` + daemon 稼働 (有効時のみ) | daemon 停止 |
| resources | `free` / `uptime` | 空きメモリ < 2 MiB |

ケースごとに NDJSON 1 行を出力。1 つでも fail があると exit 1 となり、
デバッグ材料 (`atomhack.log` 末尾 100 行、`dmesg` 末尾、`ps`、`/tmp/hack.ini`) を
`sim-results/deploy-<timestamp>/` に自動収集する (gitignore 済み)。

## 起動不能時の復旧手順

initramfs はサイズ検証 (`hexdump` でヘッダのサイズ欄とファイルサイズを照合) に通った
ファイルだけを本番位置へ移動するため、**転送が途中で切れた壊れたファイルで起動不能になることはない**。
それでも起動しなくなった場合:

1. **SSH が通る場合** — バックアップを書き戻す:

   ```bash
   ./scripts/deploy_remote.sh <HOST> --rollback
   # または手動で
   ssh root@<HOST> 'cp /media/mmc/rootfs_hack.squashfs.bak /media/mmc/update/rootfs_hack.squashfs && sync && reboot'
   ```

2. **SSH が通らない場合 (最終手段)** — SD カードを抜いて PC でマウントし、
   `rootfs_hack.squashfs.bak` を `rootfs_hack.squashfs` にリネームして戻す。
   それでもダメなら SD を FAT32 でフォーマットし直して `atomcam_tools.zip` の内容を展開する (初回導入と同じ手順)。

## Web UI ビルド (`WEB_UI`)

`buildscripts/local_build.sh` は環境変数 `WEB_UI` でフロントエンドを切り替える。

| 値 | 内容 |
|----|------|
| `web-new` (既定) | `web-new/` の Vite ビルド。gzip のみを lighttpd 配下へ配置 |
| `web` | 従来の Vue2 `web/source` ビルド |

```bash
# 新 UI (既定)
make build

# 明示的に legacy Vue2
WEB_UI=web make build

# web-new のみローカル検証
cd web-new && npm ci && npm run build && npm run budget
```

デモ/CI: `.github/workflows/webui.yml` が `web-new` の lint / typecheck / build / bundle budget を検証する。

## Tailscale (mmc wrapper)

ATOMCam の busybox には **`flock` コマンドがない**。`flock -n` を使う wrapper は cron 毎分実行でも即 exit し、Tailscale が一切起動しない。

| 項目 | 正本 |
|------|------|
| 起動スクリプト | `/media/mmc/tailscale_wrapper.sh`（`scripts/hil/debug/tailscale_wrapper.sh` と同期） |
| 設定 | `/media/mmc/hack.ini`（`TAILSCALE_AUTH_KEY` / `TAILSCALE_HOSTNAME` / `TAILSCALE_TAGS`） |
| 状態永続化 | `/media/mmc/tailscaled.state` → `/tmp/tailscale/tailscaled.state` |
| ログ | `/tmp/tsd.log` |

### `TAILSCALE_ENABLE=off` の意味

squashfs の `S80tailscale` → `/scripts/tailscale.sh start` と mmc cron の wrapper が**二重起動**しないよう、`hack.ini` で `TAILSCALE_ENABLE=off` にすると boot 時の S80 はスキップされる。**Tailscale の実質正本は mmc wrapper + crontab**。

次回 squashfs 再デプロイ時は `overlay_rootfs/scripts/tailscale.sh` も fakebin・state 復元・`--reset` 削除済み版に更新される（S80 を再有効化する場合の競合防止）。

### 相互排他（busybox 互換）

`flock` の代わりに **mkdir ロック**を使う:

```sh
LOCKDIR=/var/run/tailscale_wrapper.lock.d
if ! mkdir "$LOCKDIR" 2>/dev/null; then exit 0; fi
trap 'rmdir "$LOCKDIR" 2>/dev/null' EXIT INT TERM
```

### トラブルシュート

| 症状 | 確認 |
|------|------|
| `/tmp/tsd.log` が無い | wrapper が一度も完走していない（`flock: not found` 等） |
| stale socket | `/var/run/tailscale/tailscaled.sock` が残り `pidof tailscaled` が空 → socket と pid を削除して再実行 |
| `invalid key` | `hack.ini` の `TAILSCALE_AUTH_KEY` を更新。**重複行があると先頭行が使われる**ので 1 行に統一すること |
| `tailscale up` タイムアウト | mips 実機は LocalBackend 起動に数分かかる。wrapper は `timeout 420` / `--timeout=180s` を想定。高 load 時は再起動後に再試行 |

### 手動確認（SSH）

```bash
# lll-legacy 経由の例
ssh root@10.0.0.228 'sh /media/mmc/tailscale_wrapper.sh; pidof tailscaled; tail -20 /tmp/tsd.log'
PATH=/tmp/fakebin:$PATH tailscale status   # カメラ上
tailscale status | grep atomcam             # tailnet 側
```
