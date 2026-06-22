# SD デバッグブート資産

カメラ初回ブートストラップで WiFi / tailscale を調査するときに SD 直下へ配置するファイルの正本です。

## 配置方法

```powershell
# リポジトリ正本から
.\scripts\hil\hil-windows.ps1 install -DebugBoot

# または skill 経由（legacy から sync 後）
pwsh ~/.cursor/skills/atomcam-hil-loop/scripts/hil-windows.ps1 install -DebugBoot
```

`-DebugBoot` 時に SD ルートへコピーされるファイル:

| 正本 | SD 上のパス |
|------|-------------|
| `wifi_audit.sh` | `/media/mmc/wifi_audit.sh` |
| `tailscale_wrapper.sh` | `/media/mmc/tailscale_wrapper.sh` |
| `crontab` | `/media/mmc/crontab`（LF のみ） |
| （空マーカー） | `atom-debug`, `atom-log` |

## 収集

電源 OFF → SD を PC に戻したあと:

```powershell
.\scripts\hil\hil-windows.ps1 debug-collect
```

出力: `sim-results/sd-bootstrap/logs/debug-bundle-*/`

## 注意

- `crontab` に `network_init.sh restart` を入れない（毎分 `wpa_supplicant` が kill される）
- WPA 設定は `group=CCMP` のみ（古い wpa_supplicant は `CCMP TKIP WEP104 WEP40` をパースできない）
