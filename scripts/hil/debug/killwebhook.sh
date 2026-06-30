#!/bin/sh
# Stop writerless-FIFO awk storm (webhook.sh execs awk; killall webhook.sh misses it).
for p in $(ls -1 /proc 2>/dev/null | grep '^[0-9]'); do
  [ "$(cat /proc/$p/comm 2>/dev/null)" = awk ] || continue
  tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null | grep -q atomapp && kill -9 "$p" 2>/dev/null
done
