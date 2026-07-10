#!/bin/sh
# memory_check(cron 毎時10分) — SD 直書きをやめ、tmpfs へ NDJSON 1行で記録する。
# 00:10 の回だけ atomhack.log に日次サマリ 1 行を残す(長期傾向の確認用)。

mkdir -p /tmp/perf
read _up _ < /proc/uptime
free | awk -v up="$_up" '/^Mem:/ {printf "{\"case\":\"memcheck\",\"up\":%s,\"total\":%s,\"used\":%s,\"free\":%s,\"cache\":%s}\n", up, $2, $3, $4, $6}' >> /tmp/perf/ring.ndjson

if [ "$(date +%H)" = "00" ]; then
  free | awk -v d="$(date +'%Y/%m/%d %H:%M:%S')" '/^Mem:/ {printf "%s : daily mem total=%s used=%s free=%s cache=%s\n", d, $2, $3, $4, $6}' >> /media/mmc/atomhack.log
  # 主要常駐の RSS も日次で残す(緩いメモリリークの犯人特定用。実測: used が
  # +1MB/日 前後で漸増しており、プロセス別の長期推移がないと切り分けできない)
  for p in iCamera_app go2rtc v4l2rtspserver lighttpd; do
    PID=$(pidof "$p" 2>/dev/null | awk '{print $1}')
    [ -n "$PID" ] || continue
    awk -v n="$p" -v d="$(date +'%Y/%m/%d %H:%M:%S')" '{printf "%s : daily rss %s=%dKB\n", d, n, $24*4}' /proc/$PID/stat 2>/dev/null
  done >> /media/mmc/atomhack.log
fi
