# WebUI 詳細設定ガイド

[README に戻る](../README.md)

### カメラ画像ページ

**初期表示ページ**

- **AtomSwing**: Pan/Tiltスライダーでカメラ操作
- **AtomCam/WyzeCamV3**: スライダー非表示
- **ナイトビジョン**: 右下ボタンでon/auto/off切り替え

### カメラ設定（ATOMCam/ATOMSwingのみ）

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/CameraSettings.jpg" /></kbd>

ATOMアプリの設定項目をWebから操作可能。設定は即時反映されます。

#### 機能設定

##### ナイトビジョン
- **ON**: 暗視白黒画像
- **OFF**: カラー画像
- **AUTO**: 環境に応じて自動切り替え

##### 切り替えタイミング（AUTO選択時）
- **暗い** / **非常に暗い** から選択

##### 赤外線ライト（ON/AUTO選択時）
ナイトビジョン時の赤外線ライト点灯設定

#### 検出設定

##### モーション検知
- モーション検知録画の有効/無効
- ここがOFFだと録画設定のモーション検知録画が動作しません

##### 感度調整
**高** / **中** / **低** から選択

##### 検知エリア
- **全領域** / **選択範囲** の切り替え
- 選択範囲時はオレンジ枠で範囲設定

##### サウンド検知
音声による検知録画の設定

##### 火災/CO警報音検知
特定警報音による検知録画

##### モーションタグ
検知時の緑色枠表示

##### 録画モード
- **連続録画**: 常時録画
- **検知時のみ**: モーション検知時のみ
- **録画なし**

#### その他設定

##### ステータスランプ
正面LED点灯設定

##### 画像180°反転
画像の上下反転

##### タイムスタンプ
画面右側の時刻表示

##### ロゴ
- 左下watermark（ロゴ）の表示設定
- デフォルト: `atomcam_tools`文字
- 変更: システム設定から可能
- 元のATOMロゴに戻す: SD-Cardの`watermark.bgra`を削除して空ファイル作成

#### 詳細設定

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/AdvancedSettings.jpg" /></kbd>

##### ISP設定
- カメラのISP設定値変更（即時反映・再起動後も維持）
- デフォルト復元: Refreshボタン
- 対応項目: contrast～sharpness等

### SD Cardページ

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/sdcard.jpg" /></kbd>

カメラ内SD-Cardの映像記録フォルダーにアクセス：

- **alarm_record**: モーション検知録画
- **record**: 連続録画
- **time_lapse**: タイムラプス

ファイルクリックでMP4/JPEG再生。SMBアクセスより低負荷です。

### 録画設定

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/recording.jpg" /></kbd>

#### 連続録画
- SD-Card/NASの`record`フォルダに1分ごとのファイル記録
- モバイルアプリアクセスのため、SD-Cardファイル名は変更不可

#### モーション検知録画
- ATOMCamアプリ設定の検出時に、クラウド保存される12秒映像をSD-Card/NASにも記録
- 保存先: `alarm_record`フォルダ
- **重要**: 「録画ファイルの自動削除」で保存日数を指定しないと削除されません

#### 録画設定項目

##### SD-Card録画 / NAS録画
各メディアへの記録有効/無効

##### 保存PATH
- strftime形式での指定
- 最後の`/`以降はファイル名（自動で`.mp4`付加）
- 例: `%Y%m%d/%H%M%S` → `/alarm_record/20211128/223000.mp4`
- フォルダ自動作成

##### ファイル自動削除
指定日数経過後の自動削除機能

##### 保存日数
録画ファイル保持期間

##### 録画スケジュール
- 曜日・時間帯指定
- 複数条件OR設定
- ボタンで項目追加・削除

##### JPEG記録停止
`/media/mmc/record`ディレクトリへのJPEG記録停止

### ⏱タイムラプス設定

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/timelapse.jpg" /></kbd>

一定時間毎の映像記録で早送り動画作成。設定項目は録画設定とほぼ同様。

#### サンプリング設定
- 開始曜日・時間指定
- 周期・回数指定で枚数決定
- 指定フレームレートで録画ファイル生成
- **重要**: サンプリング時間が重複しないよう設定
- 実行中の重複はスキップされます
- ⏱次回録画まで5分以上間隔を推奨（MP4変換時間考慮）

#### 出力fps
再生フレームレート（1秒間の表示枚数）

#### 動作状態
実行中の進捗表示

#### ⏹中止
- Lock解除後に中止ボタン
- MP4ファイル生成して停止

### メディア設定

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/media.jpg" /></kbd>

#### SD-Card設定

##### SMBアクセス
- Samba4.0でネットワークフォルダ公開
- 対象: `/record`, `/time_lapse`, `/alarm_record`
- **注意**: 負荷大のためRTSPストリーミングと同時使用非推奨
- **推奨**: Webアクセスの方が低負荷

##### 録画を直接記録
- **OFF**: RAM-Disk経由でSD-Cardにコピー
- **ON**: SD-Cardに直接ファイル生成
- SD-Cardスピードと設定に応じて最適化が必要

##### SD-Card消去
- `record`, `alarm_record`, `time_lapse`フォルダ消去
- アプリからのフォーマット無効化の代替手段
- Lock解除後にEraseボタン

#### NAS設定

##### ネットワークPATH
`//[ホスト名]/[フォルダー名]`形式で指定

##### アカウント・パスワード
- NASアクセス用認証情報
- パスワードは平文でSD-Cardに保存

### 配信設定

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/streaming.jpg" /></kbd>

> **注意**: 配信は高負荷処理のため、使用しない機能はOFFにしてください

#### RTSP設定

##### Main (video0)
- HD AVC出力
- VLC等での「ネットワークストリーミング」対応
- 音声: OFF/OPUS/AAC選択

##### Main HEVC (ATOMCamのみ, video2)
- HD HEVC出力
- RTSPのみ対応

##### Sub (video1)
- 360p/320p出力
- RTSPのみ対応

#### RTSP over HTTP
- UDP代わりにHTTP経由送出
- パケット保障あり・遅延可能性あり
- URLが変更されます

#### パスワード認証
RTSPアクセスの認証設定

#### HomeKit

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/homekit.jpg" /></kbd>

- ON後に設定ボタンでQRコード表示
- iOSホームアプリでQRコード読み取り
- 同時接続は1つのiOS/HomeHUBのみ

##### 強制接続解除
iOS解除後もQRコード非表示の場合に実行

#### RTMP（YouTube Live配信）

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/rtmp.jpg" /></kbd>

- YouTube Live URL: `rtmp://a.rtmp.youtube.com/live2/<livekey>`
- YouTube Studioでライブ配信設定確認
- 周期リスタート機能（1日程度での停止対策）

#### WebRTC

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/webrtc.jpg" /></kbd>

- LAN内WebRTC配信
- URLコピーまたはLinkボタンでアクセス

### イベント通知

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/event.jpg" /></kbd>

#### WebHook
各種イベントタイミングでURL通知

##### 通知URL
- LAN内non-secure POST想定
- フォーマット: `{ type: 'event名', data: データ }`

##### 未認証接続許可
自己証明書等での接続許可

##### 通知イベント一覧
- **動体検知**: `type: alarmEvent`
- **動体認識情報**: `type: recognitionNotify`
- **動体検知録画終了**: `type: uploadVideoFinish`
- **動体検知録画転送**: `mime: video/mp4`
- **動体検知静止画保存**: `type: uploadPictureFinish`
- **動体検知静止画転送**: `mime: image/jpeg`
- **定常録画保存**: `type: recordEvent`
- ⏱**タイムラプス開始**: `type: timelapseStart`
- ⏱**タイムラプス記録**: `type: timelapseEvent`
- ⏱**タイムラプス終了**: `type: timelapseFinish`

### クルーズ設定（AtomSwingのみ）

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/cruise.jpg" /></kbd>

#### Swing座標初期化
pan/tilt座標系の初期化（モーター動作範囲リセット）

#### クルーズ動作
- シーケンス登録順に動作・ループ
- 選択項目は薄緑色表示
- で項目追加・削除
- 編集時はクルーズOFF推奨

##### pan/tilt/速度
- 数値入力またはスライダー操作
- 速度: 1（低速）〜9（高速）

##### 動作後待機時間
移動完了から次移動までの秒数

##### 検知・追尾
- **検知**: 待機中の動体検知で待機延長
- **追尾**: 検知後の動体追尾機能
- 検知後待機時間設定

##### 追尾速度
追尾時の移動速度（1〜9）

### システム設定

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/system.jpg" /></kbd>

#### デバイス設定

##### デバイス名
CIFS(Samba) / mDNS(avahi) / NASフォルダー名に使用

##### ログイン認証
- WebUI簡易認証（MD5 digest認証）
- 安全ではないため、LAN内簡易認証用途限定
- 制限文字: `:`と`\\`は使用不可

#### 動体検知

##### 動体検知周期短縮
不感知期間を5分→30秒に短縮（設定変更時再起動）

##### 動体検知録画アップロード停止
- AtomTech AWSサーバーへの12秒録画アップロード停止
- 停止するとATOMCamアプリから録画データ閲覧不可
- 設定変更時再起動

#### ビデオ設定

##### フレームレート
1〜28fps設定

##### ビットレート設定
- **Main HD**: 300〜2000bps
- **Main HEVC HD**（ATOMCamのみ): 300〜2000bps
- **Sub 360p/320p**: 100〜500bps

#### ロゴ設定

##### PNGイメージ
- ドラッグ&ドロップでロゴ変更
- 仕様: RGBA 8bit、500px × 200px以内
- 設定ボタンで反映

### メンテナンス

<kbd><img src="https://github.com/mnakada/atomcam_tools/blob/images/maintenance.jpg" /></kbd>

#### モニタリング

##### Network確認
LAN接続確認・再接続試行

##### 異常時再起動
LAN接続不可継続時のシステム再起動

##### ping疎通確認
- 定期的疎通確認
- 指定URLに1分毎HTTP GET

#### アップデート

##### Update
- GitHub Latest Versionに自動更新（約180秒）
- 現在バージョンがLatest未満の場合のみ実行可能
- **手動更新**: PC経由でatomcam_tools.zipをSD-Card/updateフォルダに配置後リブート

##### カスタム更新ZIPファイル
独自パッケージビルド用の指定URL更新

#### 再起動

##### 定期リスタート
指定スケジュールでシステム再起動

##### リブート
- Lock解除後にRebootボタン
- 再起動時間: 60〜80秒
