# debug-hil-loop — デバッグ・修正反復ハーネス

atomcam_tools 向けの **ランタイム証拠つきデバッグループ** 入口。Cursor / lll-legacy から繰り返し実行する。

## 到達経路

| 経路 | ホスト | 現状 |
|------|--------|------|
| **tailnet** | `atomcam33` | カメラ側 Tailscale 未稼働（uname パース失敗）。`tailscale status` に **未登録** |
| **LAN** | `10.0.0.228` | 稼働中（今回の検証経路） |

`resolve` は `ATOMCAM_HOST` → `atomcam33` → `10.0.0.228` → `atomcam.local` の順で SSH を試す。

## コマンド（lll-legacy）

```bash
cd ~/atomcam_tools
export ATOMCAM_HOST=10.0.0.228   # LAN 直指定（推奨・現状）

./scripts/hil/debug-hil-loop.sh resolve      # 到達ホストを表示
./scripts/hil/debug-hil-loop.sh probe        # 実機スナップショット + ログ収集
./scripts/hil/debug-hil-loop.sh recover      # iCamera 手動起動（LD_PRELOAD なし）
./scripts/hil/debug-hil-loop.sh status       # deploy_remote --status
./scripts/hil/debug-hil-loop.sh deploy-test  # true-hil → make deploy-test
./scripts/hil/debug-hil-loop.sh loop         # probe → recover → deploy-test
```

Windows（SD ブートストラップ）:

```powershell
pwsh ~/.cursor/skills/atomcam-hil-loop/scripts/hil-windows.ps1 install -RefreshZip
pwsh ~/.cursor/skills/atomcam-hil-loop/scripts/hil-windows.ps1 debug-collect
```

## SD 必須ファイル（LAN HIL）

| mmc ファイル | 役割 |
|--------------|------|
| `S61atomcam.fixed` | libcallback タイムアウト時 **reboot しない** |
| `atom_init.fixed` | **LD_PRELOAD なし** で iCamera 起動 |
| （なし）`atom-debug` | あると iCamera スキップ |

`rootfs_hack.squashfs` の `S20mountfs` が上記 `.fixed` を起動時に bind。

## ログ出力

- 計装: `sim-results/debug-6ef2a6.log`（NDJSON）
- プローブ: `sim-results/debug-hil-<timestamp>/`（probe.txt, atomhack.tail, dmesg.tail 等）

## 関連

- 真 HIL: `scripts/hil/true-hil.sh`
- Skill: `atomcam-hil-loop`（本ハーネスを含むループ手順）
- 汎用調査: `debug-hunt`
