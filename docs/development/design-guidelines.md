# WebUI デザインガイドライン(LDSG 由来の規律)

本プロジェクトの WebUI(web-new)は M3(Material 3)のカラートークンを土台に、
[LINE Design System for Global Family Service (LDSG) v3.5](https://designsystem.line.me/LDSG) の
**Foundation 規律**を移植している(参照 2026-07-11)。LDSG の思想は
「最小限の Foundation ルールで一貫性を担保し、その範囲内で自由にカスタマイズする」こと。
色相(ブランドカラー)は本プロジェクト独自の青系を維持し、**構造の規律だけ**を取り入れる。

## 1. 角丸(Object Styles) — 画面占有率で使い分ける

LDSG の radius 思想: 小さい部品ほど小さく、画面を大きく占める部品ほど大きく。

| Tailwind クラス | 値 | 使う場所 | LDSG 対応 |
|---|---|---|---|
| `rounded-badge` | 3px | バッジ・タグなどの小物 | ldsg-radius-100 |
| `rounded-control` | 5px | ボタン・入力・セレクト・チップ・summary | ldsg-radius-200 |
| `rounded-card` | 7px | ページ内カード(画面の50%未満) | ldsg-radius-300 |
| `rounded-sheet` | 12px | モーダル・シート・トースト・浮遊バー(50%超・オーバーレイ) | ldsg-radius-400 |
| `rounded-full` | 50% | 円形(スイッチ・ピル・アイコンボタン) | ldsg-radius-circle |

`rounded-sm/md/lg/xl` は新規コードで使わない(既存の残置は見つけ次第移行)。

## 2. 余白 — 4px の倍数

- コンポーネント**間**の余白は 4px の倍数(必須)。最小例外は 2px(`0.5`)。
- コンポーネント**内部**も可能な限り 4px の倍数を推奨。
- NG 例: `py-2.5`(10px)・`gap-1.5`(6px) → `py-3`・`gap-2` へ。
- 設定行の標準は `px-4 py-3`(16/12px)。

## 3. タイポグラフィ — Title / Text の2系統

LDSG は「Title=締まった行間(見出し)」「Text=読ませる行間(本文)」を分ける。

| クラス | 用途 |
|---|---|
| `text-title-xl` | ページ見出し(h1) |
| `text-title-xs` | セクション見出し(h2) |
| `text-title-s` | 設定行のタイトル |
| `text-body-xs` | 説明文・tooltip(行間 1.6+日本語向け letter-spacing) |

既存の M3 スケール(`text-title-lg` 等)と共存する。本文系に `leading-relaxed` を
個別指定する代わりに `text-body-xs` を使う。

## 4. Role Color — 機能に固定した意味色

ブランド色(primary)を成功表示に流用しない。意味色は機能に固定する。

| トークン | 意味 | 使用例 |
|---|---|---|
| `success` | 完了・成功 | 送信成功・コピー完了チェック・成功トーストの縁 |
| `warning` | 注意喚起(エラーではない) | メモリ多重有効化の警告バナー |
| `info` | 補足情報(現状は予約) | 情報バナー等、必要になったら |
| `destructive` | エラー・破壊的操作 | 送信失敗・削除確認 |

light/dark 両テーマで定義済み(`--success` 等、src/index.css)。

## 5. 影 — 背景ごとに最適化(ライトのみ)

LDSG の shadow は背景色ごとに用意される。本プロジェクトでは:

- **ライト**: `shadow-l100`(カード)/`shadow-l200`(ボタン等、必要時)/`shadow-l300`(モーダル・浮遊)
- **ダーク**: 影は使わない(CSS 変数が none になる)。M3 の surface-container 面階層で奥行きを表現する。

## 出典

- Object Styles: https://designsystem.line.me/LDSG/foundation/object-styles-en
- Layout(4px spacing): https://designsystem.line.me/LDSG/foundation/layout-en
- Typography: https://designsystem.line.me/LDSG/foundation/typography-en
- Color(Role Color): https://designsystem.line.me/LDSG/foundation/color-en
