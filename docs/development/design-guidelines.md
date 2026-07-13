# WebUI デザインガイドライン(ldsg-design 準拠)

**正本は flll/skills の `ldsg-design` スキル**(LDSG v1.5.0 準拠・96変数、
`assets/ldsg-tokens.css`)。本書はその WebUI(web-new)への適用規約。
本プロジェクトの意図的な逸脱は2点のみ(末尾)。

## 1. 色 — LDSG Gray ランプ+Role Color

面・罫線・テキストは LDSG Gray ランプに固定(src/index.css が M3 変数名へマップ):

| 用途 | ライト | ダーク |
|---|---|---|
| ページ背景(surface) | White | Gray900 #111111 |
| カード(surface-container-low) | Gray150 #F5F5F5 | Gray850 #1F1F1F |
| 罫線(border) | Gray300 #DFDFDF | Gray750 #3F3F3F |
| 本文 | Black | White |
| 補助テキスト | Gray650 #616161 | Gray400 #B7B7B7 |

Role Color(機能固定・`text-success` 等で使用):

| トークン | 由来 | ライト/ダーク |
|---|---|---|
| success | ldsg role-positive | #06C755(共通) |
| destructive | ldsg role-negative | #FF334B / #FF697A |
| info | ldsg role-link | #4D73FF / #638DFF |
| warning | Rainbow amber(策定: LDSG に warning 無し) | 濃amber / #FFC53D 系 |

直値 `#hex` をコンポーネントに書かない。新しい色が要る場合は Rainbow 16色相から
選んでトークン化する(ldsg-design の必須規則)。

## 2. 角丸 — ldsg radius s/m/l

| クラス | 値 | 使う場所 |
|---|---|---|
| `rounded-badge` / `rounded-control` | 4px (radius-s) | バッジ・ボタン・入力・summary |
| `rounded-card` | 8px (radius-m) | ページ内カード |
| `rounded-sheet` | 13px (radius-l) | モーダル・トースト・浮遊バー・ポップ |
| `rounded-full` | 999px | 円形(スイッチ・ピル) |

## 3. タイポグラフィ — LINE Seed JP+px 体系

- フォント: **LINE Seed JP**(seed.line.me、SIL OFL 1.1)。UI 使用文字のサブセットを
  同梱(`src/assets/fonts/`、再生成は `scripts/subset-lineseed.sh`)。
  フォールバックは ldsg の Language Pack システムスタック
- `text-title-xl`=24px/1.3/Bold(h1)、`text-title-xs`=13px/1.3/Bold(h2)、
  `text-title-s`=15px/1.3/Medium(行タイトル)、`text-body-xs`=13px/1.5(説明文)
- Title 系は行間 1.3、Text 系は 1.5(LDSG 公式方針)

## 4. 状態 — 透過度で表現(公式)

ボタン・リンクの hover は `opacity` 0.7、pressed は 0.5(button.tsx に実装済み)。
背景色変化で hover を表現しない。

## 5. 余白 — 4px の倍数

コンポーネント間は 4px の倍数必須(最小例外 2px)。設定行の標準は `px-4 py-3`。

## 意図的な逸脱(2点)

1. **brand-primary は現行の青系を維持**(LINE Green にしない)。LDSG の
   「brand はサービスごとに差替可」思想に基づく。公開 OSS のため LINE ブランド色の
   商標懸念もゼロにする
2. **設定行の hover は背景変化を維持**(透過度でなく)。行全体がクリック対象である
   ことの視認性を優先

## 出典

- 正本: flll/skills `ldsg-design/`(SKILL.md・reference.md・assets/ldsg-tokens.css)
- LDSG: https://designsystem.line.me/LDSG
- LINE Seed: https://seed.line.me(SIL OFL 1.1)
