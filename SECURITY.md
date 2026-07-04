# SECURITY — 秘密情報の取り扱い

このリポジトリと実機(ATOMCam)には秘密が含まれる。エージェント(人間も)は以下を厳守する。

## 秘密の所在

| 場所 | 含まれるもの |
|------|--------------|
| `/media/mmc/hack.ini`(実機) | WiFi PSK・`RTSP_USER`/`RTSP_PASSWD`・HomeKit PIN・CIFS 認証 |
| `/media/mmc/tailscaled.state`(実機) | Tailscale ノード秘密鍵 |
| `authorized_keys` / agent プロファイルのデバッグ SSH 鍵 | SSH 認証情報 |
| `sim-results/`(smoke 失敗時の自動収集) | **hack.ini のスナップショットが含まれることがある** |

## ルール

1. **hack.ini の値を出力しない**: チャット・ログ・コミットメッセージ・ドキュメントに
   値を貼らない。確認が必要なときは**キー名のみ**
   (`grep -o '^[A-Za-z_]*' /tmp/hack.ini`)。
2. **コミットに秘密を入れない**: hack.ini / tailscaled.state / 秘密鍵 / トークンは追跡しない。
   deploy zip からは `deploy_remote.sh` が hack.ini / tools_configs を自動除外するが、
   **SD 用 zip には hack.ini 雛形が入る** — 実機の値をリポジトリの雛形へ書き戻さない。
3. **sim-results/ を公開しない**: git 追跡外を維持。ログを共有するときは
   PSK / パスワード / PIN / 鍵を redact してから。
4. **ネットワーク境界**: カメラは LAN / tailnet 内前提。カメラのポート(80/554/1984/4000 等)を
   WAN に公開しない。RTSP を外へ出すなら `RTSP_AUTH=on` を確認。
5. **鍵の配布**: デバッグ SSH 鍵(agent プロファイル)は検証機にのみ配置し、
   公開リポジトリ・共有ストレージに置かない。

## インシデント時

秘密が漏れた(コミット・チャット・ログに出た)と気付いたら、隠さずユーザーへ即報告し、
ローテーション(WiFi PSK / RTSP パスワード / Tailscale ノード再認証)を提案する。
