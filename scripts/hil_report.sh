#!/bin/bash
# HIL 実行履歴レポート — deploy/smoke の結果推移を集計して表示する。
#
# データ源:
#   sim-results/history.ndjson        1実行=1行(deploy_remote.sh / smoke_test_remote.sh が追記)
#   sim-results/smoke-*/result.ndjson ケース別詳細(smoke_test_remote.sh が保存)
#
# usage: hil_report.sh [N]   直近 N 件を表示(既定 20)
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HIST="$ROOT/sim-results/history.ndjson"
N="${1:-20}"

command -v jq >/dev/null 2>&1 || { echo "jq が必要です" >&2; exit 2; }

if [ ! -s "$HIST" ]; then
  echo "履歴がまだありません: $HIST"
  echo "(make deploy / make deploy-test / smoke_test_remote.sh の実行で自動的に貯まります)"
  exit 0
fi

echo "== 直近 ${N} 件 =="
{
  printf 'DATE\tRUN\tACTION\tHOST\tRESULT\tP/F/S\tELAPSED\n'
  tail -n "$N" "$HIST" | jq -r '
    [ (.timestamp | localtime | strftime("%m-%d %H:%M")),
      .run, (.action // "-"), .host, .result,
      (if .run == "smoke" then "\(.pass)/\(.fail)/\(.skip)" else "-" end),
      "\(.elapsed_s // "-")s" ] | @tsv'
} | column -t -s "$(printf '\t')"

echo
echo "== 成功率(全期間) =="
jq -sr '
  group_by(.run)[] |
  "\(.[0].run):\t\(map(select(.result == "ok")) | length)/\(length) ok"' "$HIST" \
  | column -t -s "$(printf '\t')"

echo
echo "== smoke ケース別 fail 回数(全期間) =="
FAILS="$(cat "$ROOT"/sim-results/smoke-*/result.ndjson 2>/dev/null \
  | jq -r 'select(.result == "fail") | .case' | sort | uniq -c | sort -rn)"
if [ -n "$FAILS" ]; then
  echo "$FAILS"
else
  echo "(fail なし)"
fi
