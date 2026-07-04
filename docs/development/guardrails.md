# guardrails — コードを書く前の再発防止チェックリスト

**このリポジトリで実際に起きたバグ**から抽出した禁止事項と手順。Edit/Write の前に読む。
各項目は「ルール → なぜ(実害) → どうする」の順。違反しそうなら手を止めてユーザーに確認する。

## 1. hack.ini を素手で触らない

- **ルール**: hack.ini の書き換えは (a) WebUI/CGI 経由なら JSON(`JSON.stringify`)で POST、
  (b) ssh 直接なら「行 append」か「1キーの sed」のみ。全文書き換え・テキスト POST 禁止。
- **なぜ**: hack_ini.cgi は JSON 前提。テキスト行を送ると **hack.ini が全消失**した(A-8)。
  python の `json.dumps` はデフォルト区切りで全行先頭にスペースが入り、awk の `^` アンカーが
  全滅して**設定が静かに死んだ**(A-9)。POST は途中切断も実機で観測されている。
- **どうする**: python から送るなら `separators=(",",":")` 必須。書いたら**必ず読み戻して検証**
  (`grep '^KEY=' /media/mmc/hack.ini`)。先頭スペース行がないか `grep -c '^ '` で確認。

## 2. debug 資産を実機に残置しない

- **ルール**: `-DebugBoot` や手動で `/media/mmc` に置いた `.fixed`/`crontab`/デバッグスクリプトは、
  検証が終わったら**必ず** `scripts/hil/cleanup-debug-boot.sh` で撤去する。
- **なぜ**: S20mountfs が SD 上の `.fixed` を bind mount で正規版に上書きするため、正規ビルドを
  deploy しても **debug 版が実効のまま**になる(見かけの F-3 再発)。debug crontab の wifi_audit が
  毎分走り **ログ 89MB・SD 96% 逼迫**まで進行した(2026-07-04)。
- **どうする**: 撤去 → `make deploy-test` → smoke の `preload` ケースが pass することを確認。

## 3. ハードウェアウォッチドッグ給餌(wdkeep)を殺さない

- **ルール**: `wdkeep` プロセスを kill しない。給餌スクリプトを消すときは reboot 直前のみ。
- **なぜ**: `/dev/watchdog` を open した後に給餌が止まると**ハードリセット**がかかる。
- **どうする**: ファイルの mv は可(実行中プロセスは inode を掴む)。kill は reboot で置き換える。

## 4. iCamera の stdout を FIFO に繋がない

- **ルール**: `iCamera_app` の stdout は `/dev/null` へ。`>> /var/run/atomapp` 等の FIFO 接続禁止。
- **なぜ**: FIFO 詰まりで awk が暴走し CPU を食い潰した(F-3 調査を混乱させた「awk storm」)。

## 5. シェルの方言と改行

- **ルール**: `overlay_rootfs/` 配下は **busybox sh(ash)**。bashism(配列・`[[ ]]`・
  `local -n` 等)禁止。リポジトリ側 `scripts/` は bash 可。改行は **LF のみ**。
- **どうする**: コミット前に `sh -n <file>`(overlay)/ `bash -n <file>`(scripts)。
  Windows から scp したファイルは `sed -i 's/\r$//'` してから配置。
- **スクリプト内で ssh を呼ぶなら `ssh -n`**: stdin を食われてループや heredoc が途中で死ぬ。

## 6. SD 書込を増やさない

- **ルール**: 毎分/毎秒レベルの追記を `/media/mmc` に直接書かない。ログ・計測は `/tmp`(tmpfs)へ
  書き、必要な場合のみバッチで SD へ flush する。
- **なぜ**: SD 書込は累積 write が read の 60 倍に達し、磨耗と逼迫の主因だった。
- **どうする**: 計測は `perf_sampler.sh` / `/tmp/boot_timeline.ndjson` の既存機構に乗せる。

## 7. 安全境界(起動不能リスク)

- **触れない**: `initramfs_skeleton/` / `patches/kernel/` / u-boot / SPI フラッシュ。
- **deploy は `/media/mmc/update/` 経由のみ**(サイズ検証付き)。squashfs の直接上書き禁止。
- `--rollback` と電源系操作は**ユーザー確認後のみ**。HIL 自律ループは**最大3反復**で停止・報告。

## 8. 検証してから完了報告

- **ルール**: 「動くはず」で終わらない。ビルドを触ったら `make build`、実機に触れたら
  `make deploy-test ATOMCAM_HOST=...` の **NDJSON 全ケース pass(skip 可)** を確認し、
  実出力を添えて報告する。計測系は `scripts/collect_perf_remote.sh` で前後比較を残す。

## 9. git 規約

- コミットは**日本語**・prefix(`feat:`/`fix:`/`docs:` 等)・1コミット1目的(CONTRIBUTING.md)。
- **push はユーザーが明示したときのみ。** main 直コミット(feature branch を作らない)。

## 10. 秘密の扱い

- [SECURITY.md](../../SECURITY.md) を読む。hack.ini の**値**(PSK/パスワード/PIN)を
  チャット・ログ・コミットに出さない(キー名のみ可)。

---
過去の経緯・根因の詳細: [refactor-notes.md](refactor-notes.md) /
運用コマンドの正本: [AGENTS.md](../../AGENTS.md)
