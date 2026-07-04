# CLAUDE.md — atomcam_tools

## 必読ゲート(コード変更・実機操作の前に必ず読む)

1. [AGENTS.md](AGENTS.md) — ビルド/デプロイ操作の正本(zip は1本・BUILD_MANIFEST が真実)
2. [docs/development/guardrails.md](docs/development/guardrails.md) — 実バグ由来の再発防止チェックリスト
3. [SECURITY.md](SECURITY.md) — 秘密の扱い(hack.ini の値を出力しない 等)

読了前に Edit/Write を始めない。チェックリストに違反しそうな変更は手を止めてユーザーに確認する。

## 最重要ルール(要約)

- 検証してから完了報告: `make build` / `make deploy-test ATOMCAM_HOST=...`(NDJSON 全 pass)の実出力を添える
- コミットは日本語・prefix 付き・1コミット1目的。**push はユーザー明示時のみ**
- 起動不能リスク領域(`initramfs_skeleton/` `patches/kernel/` u-boot)と SPI フラッシュに触れない
- overlay_rootfs のシェルは busybox sh(bashism 禁止・LF のみ・`sh -n` で検証)
