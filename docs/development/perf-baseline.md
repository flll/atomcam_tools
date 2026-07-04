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

## 調査で確定した事実(2026-07-04・ステップ計時+切り分け実験)

1. **OTA 直後のブートは遅い(仕様)**: initramfs が 60MB squashfs を SD へ書いた直後の
   ブートはバックグラウンド flush が SD IO と競合し、S15swap の swapon が 34s に伸びる。
   **通常ブートでは 1s 未満**。deploy-test 直後の boot_total は参考値として扱う。
2. **S55sshd 35〜59s の根因 = `/dev/random` のブロッキング読み**(fd プローブで確定):
   - cold cache 説は棄却(drop_caches 後も ssh-keygen -A は 0.6s)
   - 待機中 CPU 97% idle・iowait 増なし(perf_sampler) = 計算でも IO でもなく sleep
   - ブート中の ssh-keygen の open fd 末尾が `/dev/random`(S55 一時プローブ)
   - 解除タイミングは割り込み蓄積(S61 の insmod ラッシュ等)に依存し 35〜60s 変動
   - 対処は2段: (a) seedrng の seed を SD 永続化+credit(41beeca、59→35s に部分改善)
     (b) **S12urandom で /dev/random を urandom(c1,9)に差し替え(fcc2940、根治)**。
     seed 注入後なので urandom 品質は十分。mdev coldplug が節点を作り直すため S10 より後に置く

## 最終結果(plain reboot・全 smoke pass)

| KPI | before(7/4 朝) | after(7/4 昼) | 改善 |
|-----|-----------------|----------------|------|
| boot_total_sec | 108.12 | **30.65** | **−77.5s(3.5倍)** |
| icamera_ready_sec | 104.39 | **26.22** | **4.0倍** |
| S15swap | 22.8s | 0.49s(zram 0.03s) | |
| S55sshd | 54.6s | **0.29s**(keygen 0.09s) | |
| swap 構成 | SD 128MB のみ | zram 48MB(lz4, pri -1)+ SD fallback(pri -2) | SD 磨耗減 |
| sd_write_sectors_5s(アイドル) | 147 | 0 | |

計測: `sim-results/perf/`(baseline-phase1 → after-p2-zram → after-seedrng-plain → after-urandom-plain)

## Phase 2 採否記録

| # | 項目 | 判定 | 根拠 |
|---|------|------|------|
| 1 | SD swap → zram 主 + fallback 化 | **採用**(563de42) | zram 有効化 0.03s。通常ブートの S15swap 34.4s→0.49s(mkswap スキップ+OTA 説確定) |
| 追加 | seedrng SD 永続化 | **採用**(41beeca) | エントロピー seed の credit 供給。S55sshd 59→35s の部分改善 |
| 追加 | /dev/random→urandom 差し替え | **採用**(fcc2940) | S55sshd 0.29s へ根治。boot_total 30.65s 達成 |
| 6 | sshd 起動前倒し(順序変更) | 不要 | 根治により S55sshd は 0.3s。順序変更の意味が消滅 |
| 2 | ログ tmpfs 集約+バッチ flush | 保留 | health_check.sh は正常時 SD 書込なしと判明。アイドル SD 書込も 0/5s |
| 3 | cron 統合 guardian.sh | 保留 | 定常 load への寄与を perf_sampler の定常データで評価してから |
| 5 | vendor rtsp x16 抑止 / 7 avahi・dbus / 8 go2rtc オンデマンド / 9 tailscale 既定 off / 10 assis・hl_client / 11 webhook 復活 | 未着手 | 次回。判定は本書の KPI で行う |
