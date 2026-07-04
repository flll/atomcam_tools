#!/bin/sh
# memory_check(cron 毎時10分) — SD 直書きをやめ、tmpfs へ NDJSON 1行で記録する。
# 00:10 の回だけ atomhack.log に日次サマリ 1 行を残す(長期傾向の確認用)。

mkdir -p /tmp/perf
read _up _ < /proc/uptime
free | awk -v up="$_up" '/^Mem:/ {printf "{\"case\":\"memcheck\",\"up\":%s,\"total\":%s,\"used\":%s,\"free\":%s,\"cache\":%s}\n", up, $2, $3, $4, $6}' >> /tmp/perf/ring.ndjson

if [ "$(date +%H)" = "00" ]; then
  free | awk -v d="$(date +'%Y/%m/%d %H:%M:%S')" '/^Mem:/ {printf "%s : daily mem total=%s used=%s free=%s cache=%s\n", d, $2, $3, $4, $6}' >> /media/mmc/atomhack.log
fi
