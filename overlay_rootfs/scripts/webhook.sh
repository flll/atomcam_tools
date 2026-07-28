#!/bin/sh
# FIFO(/var/run/atomapp) reader の respawn ラッパー。イベント解析本体は /scripts/webhook.awk。
#
# awk を -f 外部ファイル化したことで cmdline が短くなり、`pkill -f webhook.awk` が
# 確実に効く(旧: 約2.5KB のインライン awk プログラムを busybox ps が切り詰め、
# killall webhook.sh も pkill -f も空振りして CPU 暴走時に停止不能だった)。
#
# dispatcher(下の while read)は awk の stdout「event<TAB>data」を notify.sh へ
# argv で渡す。notify.sh 実行中も awk は pipe バッファで先行でき、FIFO を塞がない。
# dispatcher が死ねば awk が次の出力で SIGPIPE 死し、respawn ループが両方回収する。

HACK_INI=/tmp/hack.ini
mkdir -p /tmp/log
[ -f /media/mmc/atom-log ] && ATOM_LOG="on"
[ -f /media/mmc/timelapse_hook.sh ] && TIMELAPSE_HOOK="on"
/scripts/notify.sh --discovery >/dev/null 2>&1
TAB="$(printf '\t')"

while : ; do
  awk -v HACK_INI="$HACK_INI" -v ATOM_LOG="$ATOM_LOG" -v TIMELAPSE_HOOK="$TIMELAPSE_HOOK" \
      -f /scripts/webhook.awk /var/run/atomapp \
  | while IFS="$TAB" read -r event data; do
      /scripts/notify.sh "$event" "$data"
    done
  sleep 2
done
