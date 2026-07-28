#!/bin/bash
# ホスト側(bash)共通: NDJSON 出力ヘルパ。呼び出し側は ROOT を定義してから source する。

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\r' | tr '\n' ' '
}

hil_history_append() {
  # hil_history_append NDJSON_LINE — 1実行=1行の追記型履歴(集計は make hil-report)
  # テストからは HIL_HISTORY_FILE で退避先を差し替えられる
  local hist="${HIL_HISTORY_FILE:-$ROOT/sim-results/history.ndjson}"
  mkdir -p "$(dirname "$hist")"
  printf '%s\n' "$1" >> "$hist"
}
