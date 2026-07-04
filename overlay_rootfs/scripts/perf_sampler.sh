#!/bin/sh
# perf_sampler.sh — /proc ベースの軽量ランタイムサンプラ(SD 書込ゼロ)。
#
# tmpfs リング /tmp/perf/ring.ndjson(512KB x 最大4面 = 上限2MB)に NDJSON を書く。
# 有効化: hack.ini PERF_SAMPLER=on(S19perfsampler が起動)。既定 off。
#   PERF_INTERVAL: サンプル間隔秒(既定5)
#   PERF_PROCS:    監視プロセス名(空白区切り。既定は主要常駐)
# 回収: scripts/collect_perf_remote.sh(リポジトリ側)
#
# 1行の形式:
#   {"case":"sys","up":123.4,"cpu":[user,nice,system,idle,iowait],"mem":[free,buffers,cached],"load":[l1,l5,l15]}
#   {"case":"proc","up":123.4,"name":"iCamera_app","utime":T,"stime":T,"rss_kb":N}
# cpu/utime/stime は累積 tick(USER_HZ)。差分は perf_report.sh 側で取る。

INI=/tmp/hack.ini
DIR=/tmp/perf
RING=$DIR/ring.ndjson
MAX=524288

INTERVAL=$(awk -F= '/^PERF_INTERVAL *=/ {print $2}' $INI 2>/dev/null | tr -d ' ')
[ -n "$INTERVAL" ] || INTERVAL=5
PROCS=$(awk -F= '/^PERF_PROCS *=/ {print $2}' $INI 2>/dev/null)
[ -n "$PROCS" ] || PROCS="iCamera_app v4l2rtspserver go2rtc lighttpd assis hl_client dropbear tailscaled"

mkdir -p $DIR

while : ; do
  read UP _IDLE < /proc/uptime
  CPU=$(awk '/^cpu / {print $2","$3","$4","$5","$6}' /proc/stat)
  MEM=$(awk '/^MemFree/ {f=$2} /^Buffers/ {b=$2} /^Cached/ {c=$2} END {print f","b","c}' /proc/meminfo)
  read L1 L5 L15 _R < /proc/loadavg
  {
    echo "{\"case\":\"sys\",\"up\":$UP,\"cpu\":[$CPU],\"mem\":[$MEM],\"load\":[$L1,$L5,$L15]}"
    for p in $PROCS; do
      PID=$(pidof "$p" 2>/dev/null | awk '{print $1}')
      [ -n "$PID" ] || continue
      # /proc/PID/stat: $14=utime $15=stime $24=rss(page)。監視対象名に空白が無い前提
      awk -v n="$p" -v up="$UP" \
        '{printf "{\"case\":\"proc\",\"up\":%s,\"name\":\"%s\",\"utime\":%s,\"stime\":%s,\"rss_kb\":%d}\n", up, n, $14, $15, $24*4}' \
        /proc/$PID/stat 2>/dev/null
    done
  } >> $RING
  SZ=$(wc -c < $RING)
  if [ "$SZ" -gt "$MAX" ]; then
    [ -f $RING.2 ] && mv $RING.2 $RING.3
    [ -f $RING.1 ] && mv $RING.1 $RING.2
    mv $RING $RING.1
  fi
  sleep $INTERVAL
done
