# リファクタ備忘録 (refactor-notes)

このファイルは atomcam_tools 全体リファクタ作業中の発見・判断・未解決を都度記録する作業ログ。
恒久ドキュメントは repo-map / build-profiles / architecture へ反映し、ここは経緯と理由を残す。

## 重要な発見

### F-1 (CRITICAL): overlay 必須ファイルが移動誤用で削除されていた
- `git status` に `D overlay_rootfs/atom_patch/system_bin/atom_init.sh` / `D overlay_rootfs/etc/init.d/S61atomcam`
- 原因: 直前作業で Python `Path.replace()`(=move) を使い、overlay から `scripts/hil/templates/*.fixed` へ「移動」してしまった(copy のつもりが move)
- 影響: このまま `make build` すると起動の肝心ファイルを欠いた壊れた squashfs になる
- 対応: overlay を `git checkout` で原状復帰(F-2 の理由によりそのまま戻す)

### F-2 (CRITICAL・真実): templates/*.fixed は「hack 無効化」のデバッグ版であって、ビルド正本にしてはいけない
- diff 結果:
  - `atom_init.fixed`: 原本の
    `LD_PRELOAD=.../libcallback.so /system/bin/iCamera_app >> /var/run/atomapp ...`
    を `/system/bin/iCamera_app >> $TOOLS_LOG ...` に変更 = **LD_PRELOAD を丸ごと削除**
  - `S61atomcam.fixed`: libcallback 待ちを 20→200 回に延長し、失敗時 `reboot` を `break` に変更
- libcallback(LD_PRELOAD) は atomcam_tools の**心臓部**(録画/動体/RTSP/timelapse 等を iCamera にフック)。
  これを削るとカメラは起動するが **hack 機能が全部無効**になる。
- つまり過去デバッグで「カメラが起動した」のは **libcallback を無効化したから**であり、
  iCamera + libcallback の SIGSEGV 自体は**未解決**(F-3)。
- 判断: ビルド overlay には LD_PRELOAD を残す(原状復帰)。`.fixed` は **実機 HIL デバッグ時のみ**
  `S20mountfs` が mmc から bind する**ランタイム上書き**として使う(ビルドには焼かない)。
  この分離なら「通常ビルド=hack 有効」「SD に .fixed あり=デバッグで起動優先」が両立する。

### F-3 (未解決): iCamera_app + libcallback.so で SIGSEGV
- LD_PRELOAD=libcallback.so 付き起動で SIGSEGV。preload 無しなら起動成功(デバッグで確認済)。
- これが reboot ループ(S61 が libcallback 判定失敗→reboot)の根。
- 現状は「libcallback を無効化して起動」という**回避**にとどまる。恒久対策は別途(libcallback のどの
  フックが落ちるか calibration が必要)。ll1-concept-memo / debug-hunt 案件として残す。

### F-4: reboot ループ安全化は本番にも有益(別判断)
- `S61atomcam` の「libcallback 待ち失敗で reboot」は 1 時間起動しない事象の原因になりうる。
- `reboot` をやめ `break`(起動続行) にする変更は libcallback を無効化せず安全side。
- ただし production 挙動変更なのでユーザー判断事項として明記。今回の復旧では**原状復帰**を既定とし、
  本変更は推奨として記録(勝手に焼かない)。

## 衛生・構造の発見

### F-5: 生成物・状態ファイルの混在
- `configs/active_build_profile.env` / `configs/active_profile.name` は**実行時状態** → 追跡対象 configs/ に置くと誤コミットの恐れ。`target/` へ移し gitignore。
- `.gitignore` 漏れ: `target/BUILD_MANIFEST.json` `target/LATEST.txt` `target/releases/` `target/mmc_templates/` `target/hil-bootstrap/`。

### F-6: リポジトリ root のゴミ
- `rebuild_*.log` / `docker-build_*.log` が 17 個物理残存(gitignore 済だが散乱)。
- `atomcam_tools.zip` が root 所有(他は lll 所有)で権限不整合。

### F-7: 権限不整合
- `scripts/hil`(700) と `scripts/hil/debug`(700) のみ 700、他は 755。scp 由来。755 へ統一。

### F-8: sd-package.sh の配列検査バグ(既存)
- `for f in "$required"; do` は配列の**先頭要素しか**検査しない(`"${required[@]}"` が正)。
- 影響: factory_t31 以外の必須ファイル欠落を検出できなかった。Phase1 で `"${required[@]}"` に修正済。

## 進捗ログ(実施済)

- Phase0: overlay 原状復帰(`git checkout`)。libcallback を残し hack を壊さない。
  `templates/*.fixed` は **HIL ランタイム上書き専用**(`S20mountfs` が mmc から bind)として保持。
- Phase1-A: `configs/active_*` を `target/` へ移設し参照を全更新
  (build-profile.sh / build_all / post_fakeroot.sh / post-build-profile.sh)。
  `.gitignore` に生成物(BUILD_MANIFEST/LATEST/releases/mmc_templates/hil-bootstrap/active_*/一時zip)を追加。
- Phase1-B: zip を1本(スーパーセット)に統一。
  - `build-metadata.sh`: 短名 `atomcam-{commit}[-{profile}].zip`(simple は suffix 無し)。
  - `sd-package.sh`: 正本1本を生成し `atomcam_tools.zip`/`target/sd_initial.zip` 両 symlink。配列バグ修正。
  - `post_image.sh`: docker 内では zip を作らず target へステージのみ。
  - `deploy_remote.sh`: OTA 時に hack.ini/tools_configs を除いた4ファイル zip を一時生成。
  - `Makefile`: `canonical-zip` を追加し `make build` 後に常時 1本生成。
  - 検証: release-info=atomcam-3ad28e8-harness.zip / simple=atomcam-3ad28e8.zip /
    両 symlink 同一正本 / OTA strip dry-run=4ファイル。
- Phase2: root の `*.log` 17個削除、`atomcam_tools.zip`(root所有)を symlink 化、
  `scripts/hil`/`scripts/hil/debug` を 755 に統一。
- Phase3: 全28シェルスクリプトの CRLF 正規化(4件修正)・実行ビット確認・`bash -n` 全 OK。
- Phase4: AGENTS.md / build-profiles.md を1本化・短名・会話例10件で更新。repo-map.md 追記。

## 未解決 / 申し送り

- F-3 iCamera+libcallback SIGSEGV は**未解決**(現状はランタイムで libcallback 無効化して回避)。恒久対策要。
- F-4 S61atomcam の reboot ループ安全化(reboot→break, 20→200)を **overlay に適用済**
  (ユーザー了承)。libcallback(LD_PRELOAD)は維持。失敗時は reboot せず起動継続。
- tailnet: カメラ Tailscale が uname パースで落ちる。`atomcam33` 未登録。LAN 経路のみ有効。
- commit/push 未実施(ユーザー明示時のみ)。13 commits ahead + 今回の変更。

### F-9 (解決): tailscale が起動しない真因 = Go 1.26 回帰
- 症状: `failed to parse kernel version from uname` / `panic before malloc heap initialized`。
- 真因: tailscale 1.96.x は **Go 1.26 ビルド**。Go 1.26 は古い 32bit mipsle カーネル
  (`3.10.14__isvp_swan_1.0__`)で futex_time64/uname 周りが壊れ、ヒープ初期化前にクラッシュ。
  Refs: golang/go#77730, golang/go#77930, tailscale#19039。
- 検証: 1.92.3 の埋め込み Go は **go1.25.5**(回帰前)。mipsle prebuilt は 1.92.3/1.90.5/1.88.3 のみ存在
  (1.94.x/1.95.0 は 404)。
- 対応: `tailscale-prebuilt.mk` を **1.92.3** に固定。`tailscale_wrapper.sh` の fake uname は
  syscall 経由のため無効 → 廃止(start のみ)。
- 残: 実機反映には **再ビルド+deploy** が必要(本コミットはソース修正のみ)。Go>=1.26.2 の
  tailscale mipsle build が出たら追従可。

## 2026-06-24 調査記録: F-3 (libcallback SIGSEGV) と起動安定化の深掘り

このセッションで実機(ATOM_CamV3C, app.ver 4.58.0.160, iCamera build "Mar 3 2025", 版2.5.20)を
ランタイム証拠付きで調査した結果。**ライブ映像復旧は未解決**で、firmware/libcallback の
リバースエンジニアリングが必要なことが判明した。

### F-3 の本質: libcallback はファームの iCamera_app バイナリに密結合
- `docs/development/libcallback.md` の通り、libcallback は iCamera_app の `.rodata/.text` を
  **走査して関数アドレスを特定**し、`memset`/`strncmp`/`snprintf` 等を hook する。つまり
  iCamera_app の**バイナリ配置(オフセット)に依存**する。
- dmesg 実測: `do_page_fault() #2: sending SIGSEGV to iCamera_app for invalid read access`。
  → libcallback がファームと合わないアドレスを参照して不正読み込みでクラッシュ。
- **libcallback.so は 2.5.19 と 2.5.20 で完全同一**(md5 `e964529e321ec05b4fe8a75189a62482`,
  129252B, GCC 3.3.2 / crosstool-NG 4.9.4)。つまり「2.5.20 の再ビルドで壊れた」のではなく、
  **この個体のファーム版と libcallback の前提オフセットが不一致**(F-3 は版非依存の既存問題)。
- 影響範囲(libcallback が担う機能):
  - `command.c`: **port 4000** のコマンド IF(Web UI / `/scripts/cmd` が依存)
  - `video_callback.c`: H264/265 フレームを **v4l2loopback** へ供給(=**ライブ映像/RTSP の実体**)
  - `audio_callback.c`/`jpeg.c`/timelapse webhook 等
- 帰結: **libcallback 無しでは「ライブ映像(Web UI 画像/RTSP の中身)」「port 4000」が出ない**。
  iCamera のネイティブ録画(動体/連続を SD に mp4)は libcallback 無しでも動く。

### 起動リブートループの連鎖(no-libcallback 運用時)
1. libcallback 無し → **HW ウォッチドッグ未給餌**(libcallback がやっていた)→ SoC が
   `CPU0 RESET ERROR` でハードリセット。
2. ウォッチドッグは **2 デバイス**: `/dev/watchdog`(10,130) と `/dev/watchdog0`(252,0)。
   片方給餌だけだと約235秒で他方が発火。**両方**給餌が必要。
3. iCamera の stdout は `S60webhook` の FIFO `/var/run/atomapp` に流れ、`webhook.sh` の awk が
   読む。libcallback 無しだと iCamera が大量ログを吐き、**awk が CPU 100% 暴走** → 給餌プロセス
   (wdkeep)を枯渇させ → リブート。動体検知などのイベントで遅れて発火する時限爆弾。

### 緩和策(このセッションで SD に適用、ただし完全安定は未確認)
- `atom_init.fixed`: iCamera を **libcallback 無し**で起動し、stdout を **`/dev/null`** へ
  (FIFO に流さない=awk 暴走を断つ)。
- `S61atomcam.fixed`: `killall webhook.sh` + **両ウォッチドッグ給餌 wdkeep**(setsid 常駐)。
- `/media/mmc/crontab`: 毎分 `wdkeep` 存在確認して再起動(自己修復)。
- **未解決の弱点**: boot 時の wdkeep 常駐が不安定(init 文脈の setsid detach が落ちることがある)。
  watchdog タイムアウト(~120s)に対し cron(1分粒度)は間に合わないことがある。要・堅牢化
  (inittab respawn 等)。

### tailnet (userspace-networking) の確定事項
- カーネルに **TUN 無し**(`/dev/net/tun` なし・`tun.ko` なし)→ tailscaled は
  `--tun=userspace-networking` 必須。**インバウンド(外からの直 SSH)は不可**、
  到達は **Tailscale SSH** 経由(tailscaled が処理)。
- tailscaled state を `/tmp` に置くと再起動毎に**別ノード登録**され `atomcam33-N` が増殖し
  100.x IP が変動。→ state を **`/media/mmc` にバックアップ/復元**して単一ノード・固定 IP 化。
- 永続キーは Tailscale **OAuth API**(`TS_OAUTH_CLIENT_ID/SECRET`)で発行可能(infra-secrets)。
  reusable・非ephemeral・tag:server。description に記号不可(英数+空白)。
- ACL は **grants モデル**。`group:admin → dst:* ip:*`。tag:server ノード同士は grant が無いと
  相互に見えない(lll-legacy 自身も tag:server なので atomcam を見られない)。admin ユーザー機
  (例: flll@ 所有の hx90)からは到達可。

### F-9 補足(既出): tailscale 1.92.3 固定で Go 1.26 回帰回避済み。今回 1.92.3/Go1.25.5 で
  クラッシュ無く動作確認。

### 残課題 / 次の一手
- **ライブ映像復旧 = F-3 解決**が必須。選択肢:
  1. libcallback をこの個体のファーム iCamera_app に合わせて**再リバースエンジニアリング**
     (オフセット/シグネチャ再特定)。重いが本筋。
  2. カメラファームを libcallback が対応する版へ**ダウングレード**。
  3. ライブ映像を諦め、ネイティブ SD 録画のみで運用(現状の no-libcallback 安定化の延長)。
- **起動安定化**: wdkeep の boot 常駐を inittab `respawn` 等で堅牢化する。
- 実機が高負荷時に sshd banner timeout でリモート介入不能になるため、調査は SD オフラインが確実。
