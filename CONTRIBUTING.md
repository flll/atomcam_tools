# CONTRIBUTING

## フォーク方針

flll/atomcam_tools は独自開発のフォークです。upstream (mnakada/atomcam_tools) への PR は行いません。

## ブランチ

- trunk-main 方式。main へ直接コミットします
- 実験的な変更のみ `experiment/*` ブランチを使用 (数日以内に main へ取り込むか破棄)

## コミット規約

- メッセージは日本語で書く
- prefix を付ける: `feat:` / `fix:` / `chore:` / `docs:`
- 1 コミット 1 目的
- WIP コミットは禁止

## ビルド確認

コミット前に `make build` が通ることを確認してください。

## PR

PR を出す場合は fork (flll/atomcam_tools) 内のみとします。upstream へは出しません。
