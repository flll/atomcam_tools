# AtomCam HIL と SD ブートストラップ

## 用語

| フェーズ | 経路 | SD 抜き差し |
|---------|------|-------------|
| **真 HIL** | `make build` → `make deploy-test` / `scripts/hil/true-hil.sh` | **不要** |
| **ブートストラップ** | `make sd-package` → Windows `sd-install-windows.ps1 --Bootstrap` | **初回のみ** |
| **偽 HIL（禁止）** | format → コピー → 抜いてログ読み → 繰り返し | 毎回（HIL ではない） |

一度 SSH/Tailscale で到達したら、以降は **真 HIL だけ**。SD 抜きが再発したらブートストラップ失敗として本ドキュメントの手順に戻す。

## 真 HIL（lll-legacy / main）

```bash
cd ~/atomcam_tools   # main
make build
make sd-package      # 初回ブートストラップ用 zip（反復開発では不要）
./scripts/hil/true-hil.sh status
./scripts/hil/true-hil.sh deploy-test   # または make deploy-test ATOMCAM_HOST=atomcam33
```

失敗時ログは `sim-results/deploy-*` に `smoke_test_remote.sh` が自動収集（SD 抜き不要）。

## ブートストラップ（Windows + SD）

### WiFi（ハード追加なし）

**方針 A（推奨）**: 純正 SD で公式アプリから WiFi 設定 → hack SD を `--FilesOnly` で投入（`tools_configs` 温存）。

**方針 B（フォールバック）**: `~/.cursor/secrets/atomcam-wifi.env` に `WIFI_SSID` / `WIFI_PASS` を置き、lll-legacy で:

```bash
./scripts/hil/build-tools-configs.sh
make sd-package
```

### SD インストール 2 モード

| モード | コマンド | format | tools_configs |
|--------|----------|--------|---------------|
| 初回 | `--Bootstrap` | diskpart clean | preserve または sd-package 同梱 |
| 反復 | `--FilesOnly`（既定） | しない | 常に preserve |

```powershell
$env:ATOMCAM_TOOLS_ROOT = "\\path\to\atomcam_tools"   # または lll-legacy から scp した clone
.\scripts\hil\sd-install-windows.ps1 --Bootstrap -RefreshZip
# カメラに SD 挿入・電源 ON
.\scripts\hil\boot-wait-windows.ps1
.\scripts\hil\true-hil.sh status   # lll-legacy 上
```

`--Bootstrap` は **tools_configs が既にあれば絶対に消さない**（preserve）。

### ブートストラップ未完了時のみ（例外パス）

Tailnet に出ない・SSH 不能のときだけ:

```powershell
# 詳細デバッグバンドル（推奨）
pwsh ~/.cursor/skills/atomcam-hil-loop/scripts/hil-windows.ps1 debug-collect

# 後方互換
pwsh .../hil-windows.ps1 read-artifacts
```

出力: `sim-results/sd-bootstrap/logs/debug-bundle-*/`

| ファイル | 内容 |
|---------|------|
| `debug-report.md` / `debug-report.json` | 要約・hints・tailnet スナップショット |
| `wpa_diag.json` | tools_configs 内 wpa（CRLF 検出含む） |
| `hack_ini_diag.json` | 重複キー・実効 MONITORING_* 値 |
| `highlights/` | ログ grep（Network/tailscale/wpa 等） |
| `tails/` | 各ログ末尾 80 行 |
| `tmp/` `update/` | ランタイムログ（サイズ上限付き） |

## 正本パス（atomcam_tools 内）

- 設定: `config/sd-install.json`
- SD zip: `target/sd_initial.zip`（`make sd-package`、gitignore）
- ログ: `sim-results/sd-bootstrap/`（gitignore）
- Tailscale: `~/.cursor/secrets/atomcam-tailscale.env`（git 外）

## 関連

- [remote-deploy.md](./remote-deploy.md) — `deploy_remote.sh` 設計
- `scripts/hil/` — Windows / Linux 補助スクリプト
