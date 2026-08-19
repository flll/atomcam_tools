# guardrails — 毎イテレーションの最初に全文読む

- 7.1 キャンペーンファイル（initramfs_71 / campaign-state / AGENTS-71）は触らない
- SPI / NOR / 実機 deploy はしない。公式 demo.bin 再install もしない
- WebUI の major は1パッケージ（関連 peer だけ例外）。lockfile 以外を巻き込むな
- go2rtc は custom patch 4枚。upstream に当たらなければ RALPH_BLOCKED
- `npm ci` を不用意に走らせて別差分を作るな。対象パッケージの bump だけ
- 検証は `web-new` の lint/typecheck/test/build。フル firmware ビルドはしない
- typescript 7.0 は typescript-eslint 非対応（TS>=7.1待ち）。S9 を選んだら install せず即 RALPH_BLOCKED
- go2rtc v1.9.14 に 0001-0004 は当たらない。S12 は即 RALPH_BLOCKED。パッチ再作成は人間
