# AGENTS.md

## プロジェクト概要

ATOMCam / ATOMCam2 / AtomSwing / WyzeCamV3 のファームウェアを拡張するプロジェクト。
flll/atomcam_tools フォークとして独自開発しており、**upstream (mnakada/atomcam_tools) へは PR しない**。

- ビルド基盤: Buildroot 2026.02.1 + br2-external ツリー (`custompackages/`)
- ビルド環境: Ubuntu 26.04 ベースの Docker コンテナ

## コマンド

| コマンド | 説明 |
|---|---|
| `make docker-build` | 初回のみ。Docker イメージ作成 + Buildroot フルビルド (~55 分) |
| `make build` | 反復ビルド。コンテナ内で `/src/buildscripts/build_all` を実行 |
| `make login` | builder コンテナへシェルで入る |
| `make menuconfig` | Buildroot の menuconfig (root Makefile のラッパー経由) |
| `make linux-menuconfig` | カーネルの menuconfig (同上) |
| `make savedefconfig` | defconfig の保存 (同上) |
| `make sim-swing` | AtomSwing の QEMU シミュレータを起動 |

`make menuconfig` / `make linux-menuconfig` / `make savedefconfig` は root Makefile のラッパー経由で実行する。実体はコンテナ内 `/atomtools/build/buildroot-2026.02.1` にある Buildroot ツリー。

WebUI は `web/` ディレクトリ (Vue + webpack)。ビルド成果物は `buildscripts/local_build.sh` が rootfs へ配置する。

## ディレクトリマップ

| パス | 役割 (実行環境) |
|---|---|
| `buildscripts/` | Docker コンテナ内で実行される Buildroot フック群 |
| `scripts/` | 開発ホストで実行 (`verify_tailscale_*`, `sim_atomswing.sh`) |
| `overlay_rootfs/scripts/` | カメラ実機上で実行されるスクリプト |
| `patches/` | `setup_buildroot.sh` が Buildroot / kernel ツリーへ手適用するパッチ |
| `global_patches/` | `BR2_GLOBAL_PATCH_DIR` 経由で upstream パッケージへ自動適用されるパッチ |
| `custompackages/` | br2-external ツリー (`external.desc` の name=ATOMCAM_TOOLS) |
| `configs/` | defconfig / kernel.config / toolchain fragment |
| `initramfs_skeleton/` | カーネル内蔵 initramfs のスケルトン |
| `overlay_rootfs/` | `BR2_ROOTFS_OVERLAY` (rootfs 3 層: initramfs → Buildroot rootfs → overlay) |
| `libcallback/` | uClibc 製 LD_PRELOAD フック (glibc rootfs とは別 toolchain でビルド) |
| `web/` | WebUI ソース (Vue + webpack) |
| `target/` | SD カード成果物のステージ (生成物はコミット禁止) |
| `docs/` | webui-guide + development/{architecture,repo-map,libcallback,simulation} |

## 境界

### Always (常に守る)

- コミットメッセージは日本語 (`feat:` / `fix:` / `chore:` / `docs:` prefix)
- `make build` が通る状態を維持する
- main へ直コミット

### Ask first (事前に確認)

- `configs/atomcam_defconfig` の変更
- `patches/kernel/*` の追加
- `custompackages/` へのパッケージ追加・削除
- Tailscale バージョンの変更

### Never (禁止)

- upstream (mnakada) への push / PR
- 長命な feature ブランチの作成 (実験は `experiment/*` で数日以内に決着)
- `target/` や `*.log` や `sim-results/` のコミット
- secrets のコミット

## ブランチ方針

- trunk-main 方式。main へ直コミット
- 実験のみ `experiment/*` を使用
- アーカイブは `archive/*`

## 詳細リンク

- [docs/development/repo-map.md](docs/development/repo-map.md) — 全ディレクトリの詳細マップ
- [docs/development/architecture.md](docs/development/architecture.md) — アーキテクチャ解説
- [build.md](build.md) — ビルド手順の詳細
