# AtomSwing シミュレーション

Docker 上の QEMU MIPS エミュレーションで AtomSwing 環境を再現し、Tailscale 等の検証を行う手順と結果の要約。

[ビルドガイドに戻る](../../build.md) | [README](../../README.md)

## 概要

| 項目 | Docker sim (qemu-mipsel) | 実機 (atomcam33) |
|------|--------------------------|------------------|
| SoC | Ingenic T31 (emulated) | Ingenic T31 |
| Linux RAM | cgroup 80/92 MiB | mem=80M (~72 MiB 利用可能) |
| swap | memswap_limit (+128 MiB) | SD 128 MiB (`/media/mmc/swap`) |
| Kernel | ホスト `uname -r` (7.x) | `3.10.14__isvp_swan_1.0__` |
| 実行速度 | qemu-mipsel（実機の約 10〜50 倍遅い） | ネイティブ MIPS |

## 実行方法

```bash
# 80 MiB RAM プロファイル（デフォルト）
make sim-swing

# 92 MiB RAM プロファイル
make sim-swing-92m
```

スクリプト: [`scripts/sim_atomswing.sh`](../../scripts/sim_atomswing.sh)

## 主な検証結果

| シナリオ | Sim (80m/92m) | 実機 |
|----------|---------------|------|
| tailscale version 1.96.4 | OK（ホスト kernel 7.x 経由） | FAIL（uname パース panic） |
| tailscaled RSS | ~63-69 MiB（qemu 下） | 未検証（デーモン未起動） |
| Case C (+rmem load) | 80m: OK / 92m: daemon OOM | N/A |

### 実機での既知結果

| テスト | 結果 |
|--------|------|
| tailscale 1.96.2（イメージ同梱） | Segmentation fault |
| tailscale 1.96.4（SD 配置） | `failed to parse kernel version from uname` |
| WebUI hack.ini | OK |

## リモート実機検証

実機への Tailscale 動作確認:

```bash
./scripts/verify_tailscale_remote.sh
```

## 詳細データ

生の JSON ログとプロファイル別の詳細は [`sim-results/comparison.md`](../../sim-results/comparison.md) を参照。
