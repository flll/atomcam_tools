# Agents — atomcam_tools

このリポジトリは **AI エージェントが会話だけでビルド・デプロイできる**ように設計されている。
特殊な専用コマンドや Node 間連携は不要。`make` と短い自然言語で完結する。

## ⚠️ 必読ゲート — コードを書く前に(全エージェント必須)

**Edit/Write・実機操作の前に必ず読む**(安価/軽量モデルも例外なし):

1. [docs/development/guardrails.md](docs/development/guardrails.md) — 実バグ由来の再発防止チェックリスト(10項目)
2. [SECURITY.md](SECURITY.md) — 秘密の扱い(hack.ini の値を出さない 等)

読了後、変更がチェックリストに違反しないことを確認してからコードに触る。
Cursor では `.cursor/rules/guardrails.mdc`(alwaysApply)が毎プロンプト同旨を注入する。

## いちばん大事な3点

1. **zip は1本**。`atomcam-{commit}[-{profile}].zip`(例 `atomcam-3ad28e8-harness.zip`、simple は `atomcam-3ad28e8.zip`)
2. SD もデプロイも **同じ1本**を使う。OTA の時だけ `deploy_remote.sh` が中で余分な2ファイル(`hack.ini`/`tools_configs`)を自動で除く
3. 版の真実は **`target/BUILD_MANIFEST.json`**(commit/tag/profile/時刻)。エージェントはここを読む

## ビルド(1コマンド)

```bash
cd ~/atomcam_tools          # lll-legacy が正本(main のみ)

make help                   # 一覧(既定ターゲット)
make configure              # プロファイル対話選択(エージェント無しでも可)

make build                  # 既定 profile=tailscale。終わると 1本の zip ができる
make build-harness          # HIL 反復デバッグ向け
make build-simple           # Tailscale 無効・最小(zip 名に profile 付かない)
make build-agent            # harness + デバッグ SSH 鍵
```

`make build` は docker ビルド → `sd-package` で **1本の正本 zip** を生成し、
`atomcam_tools.zip`(deploy 別名) と `target/sd_initial.zip`(SD 別名) を同じ正本へ symlink する。

## 成果物

| パス | 意味 |
|------|------|
| `target/releases/atomcam-*.zip` | **正本(版付き短名・1本)** |
| `atomcam_tools.zip` | deploy 用エイリアス(symlink) |
| `target/sd_initial.zip` | SD 用エイリアス(symlink) |
| `target/BUILD_MANIFEST.json` | 機械可読メタ(commit/tag/profile) |
| `target/LATEST.txt` | 最新 zip 名の短い要約 |

```bash
make release-info    # 次に作られる zip 名 + メタ(ビルド不要)
make artifacts       # symlink と releases/ 一覧
```

## デプロイ / HIL(現状は LAN)

```bash
# OTA(自動で hack.ini/tools_configs を除いた4ファイルを送る)
ATOMCAM_HOST=10.0.0.228 make deploy
ATOMCAM_HOST=10.0.0.228 ./scripts/deploy_remote.sh 10.0.0.228 --status
ATOMCAM_HOST=10.0.0.228 make hil-debug-loop
```

tailnet(`atomcam33`)はカメラ側 Tailscale 復旧後に `debug-hil-loop.sh resolve` が自動選択。
現状は LAN `10.0.0.228` が有効経路。

## 会話シミュレーション例(10件)

エージェントは下記のように自然言語を `make`/スクリプトへ写像する。

1. 「harness でビルドして」→ `make build-harness` → `atomcam-3ad28e8-harness.zip`(1本)
2. 「Tailscale なしの最小ビルド」→ `make build-simple` → `atomcam-3ad28e8.zip`(profile 無し)
3. 「今のコミットだと zip 名どうなる？」→ `make release-info`(ビルド前プレビュー)
4. 「SD に焼いて」→ `make build-harness` 後、Windows で `hil-windows.ps1 install -RefreshZip`(同じ1本)
5. 「10.0.0.228 に入れて」→ `ATOMCAM_HOST=10.0.0.228 make deploy`(OTA は自動で4ファイルに絞る)
6. 「カメラの状態見て」→ `./scripts/deploy_remote.sh 10.0.0.228 --status`
7. 「デバッグループ回して」→ `ATOMCAM_HOST=10.0.0.228 make hil-debug-loop`
8. 「この zip どのコミット？」→ 名前の `3ad28e8` と `target/BUILD_MANIFEST.json` を照合
9. 「前の版に戻して」→ `./scripts/deploy_remote.sh 10.0.0.228 --rollback`(端末の .bak を書き戻し)
10. 「zip って2個あったよね？」→「1本に統一済み。SD はそのまま、deploy 時だけ自動で2ファイル除く」+ `make artifacts`

## エージェントが居ない場合

`make agent-hint` で検出。未検出時は `make configure`(番号選択)→ `make build` で完結。
clone も不要(lll-legacy の `~/atomcam_tools` が正本)。

## 前提 / 境界

- ビルド: Docker + `make docker-build`(初回)
- push/commit は **ユーザー明示時のみ**
- 起動不能リスク領域(`initramfs_skeleton/` `patches/kernel/` u-boot)には触れない

## 詳細

- [docs/development/build-profiles.md](docs/development/build-profiles.md)
- [docs/development/debug-hil-loop.md](docs/development/debug-hil-loop.md)
- [docs/development/hil-bootstrap.md](docs/development/hil-bootstrap.md)
- [docs/development/repo-map.md](docs/development/repo-map.md)
- 作業経緯/未解決: [docs/development/refactor-notes.md](docs/development/refactor-notes.md)
