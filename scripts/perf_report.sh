#!/bin/bash
# perf_report.sh BEFORE_DIR AFTER_DIR — collect_perf_remote.sh の計測2点を比較し Markdown を出力する。
# KPI: boot_total_sec / icamera_ready_sec / load_1min / mem(free+cache) / SD 累積書込セクタ
# 付録: S* 所要時間上位・プロセス別 RSS 最終値
set -u
A="${1:?usage: perf_report.sh BEFORE_DIR AFTER_DIR}"
B="${2:?usage: perf_report.sh BEFORE_DIR AFTER_DIR}"

val_tl()   { grep -o "\"$2\",\"uptime\":[0-9.]*" "$1/boot_timeline.ndjson" 2>/dev/null | tail -1 | grep -o '[0-9.]*$'; }
val_load() { tail -1 "$1/loadavg.txt" 2>/dev/null | awk '{print $1}'; }
val_mem()  { awk '/^Mem:/ {print $4+$6}' "$1/free.txt" 2>/dev/null; }
val_sdw()  { awk '$3=="mmcblk0" {print $10}' "$1/diskstats.txt" 2>/dev/null; }
val_up()   { head -1 "$1/loadavg.txt" 2>/dev/null | sed 's/.*up */up /;s/,.*//'; }

row() { printf '| %s | %s | %s |\n' "$1" "${2:-n/a}" "${3:-n/a}"; }

echo "# perf report"
echo ""
echo "- before: $A ($(val_up "$A"))"
echo "- after:  $B ($(val_up "$B"))"
echo ""
echo "| KPI | before | after |"
echo "|-----|--------|-------|"
row "boot_total_sec"      "$(val_tl "$A" boot_total)"     "$(val_tl "$B" boot_total)"
row "icamera_ready_sec"   "$(val_tl "$A" icamera_ready)"  "$(val_tl "$B" icamera_ready)"
row "load_1min"           "$(val_load "$A")"              "$(val_load "$B")"
row "mem_free+cache_kb"   "$(val_mem "$A")"               "$(val_mem "$B")"
row "sd_write_sectors(累積)" "$(val_sdw "$A")"            "$(val_sdw "$B")"
echo ""

for d in "$A" "$B"; do
  if [ -s "$d/boot_timeline.ndjson" ] && grep -q '"boot_script"' "$d/boot_timeline.ndjson"; then
    echo "## S* 所要時間 上位10 — $d"
    echo ""
    grep '"boot_script"' "$d/boot_timeline.ndjson" | \
      sed 's/.*"script":"\([^"]*\)","start":\([0-9.]*\),"end":\([0-9.]*\).*/\1 \2 \3/' | \
      awk '{printf "%s %.2f\n", $1, $3-$2}' | sort -k2 -rn | head -10 | \
      awk '{printf "- %s: %ss\n", $1, $2}'
    echo ""
  fi
done

for d in "$A" "$B"; do
  if [ -s "$d/ring.ndjson" ] && grep -q '"case":"proc"' "$d/ring.ndjson"; then
    echo "## プロセス RSS 最終値 — $d"
    echo ""
    grep '"case":"proc"' "$d/ring.ndjson" | \
      sed 's/.*"name":"\([^"]*\)".*"rss_kb":\([0-9]*\).*/\1 \2/' | \
      awk '{last[$1]=$2} END {for (k in last) printf "- %s: %s KB\n", k, last[k]}' | sort
    echo ""
  fi
done
