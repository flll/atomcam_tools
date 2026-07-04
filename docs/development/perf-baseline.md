# パフォーマンスベースラインと軽量化の採否記録

計測基盤: `overlay_rootfs/etc/init.d/rcS` のブートタイムライン(tmpfs NDJSON)+
`perf_sampler.sh`(hack.ini `PERF_SAMPLER=on`)。回収は `scripts/collect_perf_remote.sh HOST LABEL`、
比較は `scripts/perf_report.sh BEFORE AFTER`。smoke の `perf` ケースにも同 KPI を情報記録。

## KPI 定義

| KPI | 意味 | 取得元 |
|-----|------|--------|
| boot_total_sec | 電源投入→S99 完了 | boot_timeline `boot_total` |
| icamera_ready_sec | 電源投入→libcallback コマンド応答 | boot_timeline `icamera_ready` |
| load_1min | 定常負荷(起動5分後以降で評価) | /proc/loadavg |
| mem_free+cache_kb | 実質利用可能メモリ | free |
| sd_write_sectors | SD 書込量(累積/レート) | /proc/diskstats mmcblk0 |
| proc RSS | プロセス別実メモリ | perf_sampler `proc` |

## Phase 0(debug 残骸撤去)前後 — 2026-07-04

| 項目 | before(残骸あり) | after(撤去+再起動直後) |
|------|-------------------|--------------------------|
| load(1/5/15) | 3.24 / 3.15 / 3.00(定常) | 起動直後のため後日定常値で評価 |
| free+cache_kb | 45,676 | 56,992 |
| SD 使用率 | 96%(残 622MB) | 94%(残 952MB) |
| LD_PRELOAD | なし(F-3 状態) | あり(maps 2 entries・port 4000 LISTEN) |
| wifi_audit.log | 89MB・毎分成長 | 撤去(cron 行も消滅) |

計測ディレクトリ: `sim-results/perf/baseline-phase0-20260704-103334/` → `after-phase0-20260704-104325/`

## Phase 1 ベースライン(計装入りビルド f5503d4, 2026-07-04)

計測: `sim-results/perf/20260704-105316-baseline-phase1-3f20c19/`

| KPI | 値 |
|-----|-----|
| boot_total_sec | **108.12** |
| icamera_ready_sec | **104.39**(cmd_ok=true) |
| load_1min(起動1分後) | 2.12 |
| sd_write_sectors_5s | 147 |
| preload(smoke) | pass(maps_entries=2) |

### S* 所要時間(ブートの内訳・上位)

| スクリプト | 所要 | 備考 |
|-----------|------|------|
| **S55sshd** | **54.6s** | dropbear 起動がブートの半分。原因未調査(最優先の調査対象) |
| **S15swap** | **22.8s** | SD 上の 128MB swap を毎ブート mkswap している |
| S61atomcam | 13.5s | iCamera 起動+libcallback 応答待ち(妥当) |
| S41network | 5.4s | WiFi 接続 |
| S42ntpd | 2.2s | |
| S80tailscale | 1.8s | TAILSCALE_ENABLE=off でもこの時間 |
| 残り全部 | <1s | |

→ **S55sshd と S15swap だけで 77秒/108秒**。Phase 2 はここから着手する。

## Phase 2 採否記録

| # | 項目 | 判定 | 根拠(perf_report 差分) |
|---|------|------|--------------------------|
| 1 | SD swap → zram(+ mkswap 毎ブート回避) | 実施中 | 期待: S15swap 22.8s → 1s 未満 + SD 磨耗減 |
| 6' | S55sshd の 54.6s 停滞の根因調査 | 未着手 | タイムラインで新発見。単なる順序変更(#6)より先に根因を見る |
