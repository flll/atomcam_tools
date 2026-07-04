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

## 撤去(必須・使用後は必ず実行)

**debug 資産を SD に残したままにしない。** 残置すると S20mountfs の bind mount で
no-preload 版 atom_init が正規版を上書きし続け(見かけの F-3 再発)、crontab マージで
wifi_audit が毎分走り SD を食い潰す(2026-07-04 に実害: wifi_audit.log 84MB・SD 96%)。

```bash
# lll-legacy の repo ルートで(まず DRY_RUN で対象確認)
scripts/hil/cleanup-debug-boot.sh 10.0.0.228
DRY_RUN=0 scripts/hil/cleanup-debug-boot.sh 10.0.0.228
make deploy-test ATOMCAM_HOST=10.0.0.228   # 再起動で LD_PRELOAD 復活
```

撤去は削除ではなく `/media/mmc/debug-archive-<ts>/` への mv(戻すのも mv)。
実行中の wdkeep(HW ウォッチドッグ給餌)は殺さない設計。

## F-3 解決後 (2026-06-30)

- `atom_init.nopreload.fixed` — 旧安定化（LD_PRELOAD なし）。退避用。
- `scripts/hil/atom_init.preload.fixed` — **本番同等** mmc 上書き（`/media/mmc/libcallback.so` + LD_PRELOAD）。
- `F3_PRELOAD=1 bash scripts/hil/flash-fix.sh` で preload 版を配信。
- overlay `atom_init.sh` も LD_PRELOAD 復帰済み（次回 `make build` で焼き込み）。
- wdkeep / killwebhook は当面維持。overlay 焼き後に段階撤去。
