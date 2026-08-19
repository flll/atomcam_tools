# Ralph iteration — atomcam_tools latest 上げ

あなたは自律ループの1イテレーションです。**このイテレーションで扱うストーリーは1つだけ**。
終わったらプロセスは終了し、次のイテレーションはまっさらな文脈で起動します。
引き継ぎは git 履歴・`.ralph/prd.json`・`.ralph/guardrails.md`・`AGENTS.md` だけです。

## 手順（この順で）

1. `.ralph/guardrails.md` を**全文**読む。ここに書かれた罠は必ず避ける。
2. `.ralph/prd.json` を読み、`passes: false` かつ `dependencies` がすべて完了しているストーリーのうち、
   `priority` が最も小さいものを1つ選ぶ。
3. **すべて `passes: true` なら、`RALPH_COMPLETE` とだけ出力して終了する。**
4. 選んだストーリーだけを実装する。`acceptance` をすべて満たすこと。
   **関係ないリファクタ・機能追加・整形をしない。**
5. 検証する（下記）。失敗したら直す。
6. 検証が通ったらコミットする（日本語・意味単位）。
7. `.ralph/prd.json` の当該ストーリーを `"passes": true` にする。
8. `.ralph/progress.txt` に3行以内で追記する（何をしたか・詰まった点・次への注意）。
9. 再発しうる罠を踏んだら `.ralph/guardrails.md` に1行足す（**全体で20行以内**。古い項目は消す）。
   リポジトリ恒久の作法に昇格するものは `AGENTS.md` へ。

## 検証コマンド（必ず実行し、実際の出力を確認する）

```bash
cd web-new && npm run lint && npm run typecheck && npm run test && npm run build
```

どれか1つでも exit 0 でなければ「失敗」です。**通っていないのにコミットしない・次へ進まない。**
デバイス系ストーリーでもこのコマンドは回帰として必ず通す。フル `make build` はしない（時間切れになる）。

## 途中で止める条件

以下のときはコミットせず、理由を `.ralph/progress.txt` に書いてから
`RALPH_BLOCKED: <1行の理由>` を出力して終了する。

- 検証が2回直しても通らない
- 仕様が曖昧で、どう作るかの判断に人間の意図が要る
- 秘密情報・本番環境・不可逆操作が必要になった

**同じ失敗を繰り返して粘らない。** 止まるのは失敗ではなく設計どおりの動作です。

## このリポジトリの約束

- コミットメッセージは**日本語**。AI の著作権トレーラー（`Co-Authored-By` 等）を**入れない**。
- **`git push` しない。** ローカルコミットまで。
- **デプロイしない。** squashfs を実機へ送らない。SPI / NOR に触れない。
- 秘密（トークン・パスワード等）をコミットしない・出力しない。
- `campaign-state.json` / `docs/campaign/` / `initramfs_71/` は触らない（7.1 キャンペーンの dirty）。
- 公式 ATOM ファームの再インストールはしない（hack が消える。人間が demo.bin で戻す判断）。

## ファイルの地図

- `web-new/package.json` / `web-new/package-lock.json` — WebUI 依存
- `custompackages/package/tailscale-prebuilt/tailscale-prebuilt.mk` — Tailscale 1.92.3
- `custompackages/package/go2rtc/go2rtc.mk` — go2rtc コミットピン（パッチ 0001–0004 あり）
- `Dockerfile` / `Makefile` / `docker-compose.yml` — Buildroot 2026.02.1
- `.github/workflows/` — CI（このキャンペーン開始時点で actions は最新 major 済み）

## 出力

最後に、実施したストーリー ID と検証結果を3行以内で書く。
全ストーリー完了時のみ `RALPH_COMPLETE`、続行不能時のみ `RALPH_BLOCKED: <理由>` を出力する。
