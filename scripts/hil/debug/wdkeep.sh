#!/bin/sh
# Feed BOTH hardware watchdogs so the SoC does not hard-reset (~60s / ~235s without both).
[ -e /dev/watchdog ]  && exec 8>/dev/watchdog  2>/dev/null
[ -e /dev/watchdog0 ] && exec 9>/dev/watchdog0 2>/dev/null
while true; do
  printf '1' >&8 2>/dev/null
  printf '1' >&9 2>/dev/null
  sleep 3
done
