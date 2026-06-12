# SD カードイメージのビルド

atomcam_tools の開発・ビルド環境構築ガイド。flll フォークでは **Buildroot 2026.02.1**・**Ubuntu 26.04**・**Tailscale** 同梱を前提としています。

[README に戻る](README.md) | [アーキテクチャ詳細](docs/development/architecture.md) | [シミュレーション](docs/development/simulation.md)

## 必要な環境

### 対応 OS

| OS | 備考 |
|----|------|
| **Ubuntu 26.04** | 推奨（primary） |
| Linux（その他） | Docker 実行可能なら可 |
| macOS | `make lima` で Lima + Docker |
| Windows | WSL2 + Docker |

### 必要なツール

- Git
- Docker（`docker compose` または `docker-compose`）
- Lima（macOS のみ）

> **動作確認済み**: Ubuntu 26.04 + Docker

## クイックスタート

```bash
# リポジトリのクローン
git clone https://github.com/flll/atomcam_tools
cd atomcam_tools

# Docker イメージのビルド（初回のみ）
make docker-build

# ビルド実行
make build

# macOS の場合（Lima セットアップ）
make lima
```

所要時間: 初回は約 1 時間。完了後 `target/atomcam_tools.zip` が生成されます。

## 成果物

ビルド完了後、`atomcam_tools.zip` に以下の 4 ファイルが含まれます。

| ファイル | 説明 |
|----------|------|
| `authorized_keys` | SSH 公開鍵認証用 |
| `hostname` | デバイス名（mDNS / Samba） |
| `factory_t31_ZMC6tiIDQN` | ファクトリーブートファイル |
| `rootfs_hack.squashfs` | カスタムルートファイルシステム |

## カスタマイズ

### SSH 公開鍵の追加

```bash
cat ~/.ssh/id_rsa.pub >> ./target/authorized_keys
```

### デバイス名の変更

```bash
echo "新しいホスト名" > ./target/hostname
```

上記 4 ファイルを SD カードルートにコピーしてカメラに挿入。初回起動時は swap 作成と SSH ホストキー生成のため約 40 秒かかります。

## Docker 操作

```bash
# コンテナへログイン
make login

# macOS: Lima 起動
make lima

# Linux: コンテナ起動
docker compose up -d
```

ビルド環境は Docker イメージ作成後、コンテナが起動した状態で利用します。作業ディレクトリは `/atomtools/build/buildroot-2026.02.1` です。

## よく使う make ターゲット

いずれもホスト側（リポジトリルート）で実行します。コンテナが起動していなければ自動で起動し、コンテナ内の Buildroot ディレクトリで実行されます。

| コマンド | 用途 |
|----------|------|
| `make build` | フルビルド（イメージ未作成なら `docker-build` も実行） |
| `make menuconfig` | rootfs パッケージ選択 |
| `make linux-menuconfig` | カーネル設定変更 |
| `make busybox-menuconfig` | busybox 設定変更 |
| `make linux-rebuild` | カーネル・initramfs 再ビルド |
| `make savedefconfig` | 設定変更を `configs/atomcam_defconfig` に書き戻し |
| `make clean` | ビルド成果物のクリーン |
| `make login` | コンテナへログイン |
| `make distclean` | コンテナ・ボリューム・イメージの削除 |

個別パッケージの再ビルドは `make login` でコンテナに入り、Buildroot ディレクトリで実行します。

```bash
make login
# コンテナ内で
make -C /atomtools/build/buildroot-2026.02.1 <package>-rebuild
```

変更後は `make build` で `target/` に成果物がコピーされます。

### コンパイラ環境

- **glibc（rootfs 用）**: `/atomtools/build/buildroot-2026.02.1/output/host/usr/bin/mipsel-ingenic-linux-gnu-`
- **uClibc（libcallback 用）**: `/atomtools/build/cross/mips-uclibc/bin/mipsel-ingenic-linux-uclibc-`

## Tailscale

rootfs に Tailscale が同梱されています。WebUI のシステム設定から有効化できます。

実機での動作確認:

```bash
./scripts/verify_tailscale_remote.sh
```

シミュレーション環境での検証は [docs/development/simulation.md](docs/development/simulation.md) を参照。

## AtomSwing シミュレーション

QEMU 上で AtomSwing 環境を再現し、メモリ制約下での動作を検証します。

```bash
make sim-swing      # 80 MiB RAM プロファイル
make sim-swing-92m  # 92 MiB RAM プロファイル
```

## WebUI 開発

| 項目 | 内容 |
|------|------|
| ソース | `web/` |
| フロントエンド | Vue.js + ElementUI |
| バックエンド | lighttpd + CGI |
| メインコンポーネント | `web/source/vue/Setting.vue` |

MIPSEL ターゲットのため Node.js はホストでビルドし、成果物のみ rootfs に配置します。

## 詳細ドキュメント

- [システムアーキテクチャ](docs/development/architecture.md) — 起動シーケンス、init スクリプト、内部スクリプト一覧
- [libcallback フック仕様](docs/development/libcallback.md) — iCamera_app パッチの詳細
- [シミュレーション](docs/development/simulation.md) — QEMU 検証手順と結果

## 開発サポート

- **Issues**: [flll GitHub Issues](https://github.com/flll/atomcam_tools/issues)
- **ドキュメント**: [README.md](README.md)
