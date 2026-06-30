#!/bin/bash
# Build libcallback tier variants for F-3 binary search.
# Usage: ./scripts/hil/build_libcallback_tier.sh [t0|t1|t2|t3|t4|t5|full|all]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TIER="${1:-t0}"
STUB="$ROOT/scripts/hil/libcallback_tier_stub.c"
cd "$ROOT"

tier_srcs() {
  case "$1" in
    t0) echo "libcallback_tier_stub.c" ;;
    t1) echo "libcallback_tier_stub.c setlinebuf.c freopen.c" ;;
    t2) echo "libcallback_tier_stub.c setlinebuf.c freopen.c command.c" ;;
    t3) echo "libcallback_tier_stub.c setlinebuf.c freopen.c command.c video_callback.c video_control.c" ;;
    t4) echo "libcallback_tier_stub.c setlinebuf.c freopen.c command.c video_callback.c video_control.c jpeg.c audio_callback.c audio_control.c audio_play.c" ;;
    t5) echo "libcallback_tier_stub.c setlinebuf.c freopen.c command.c video_callback.c video_control.c jpeg.c audio_callback.c audio_control.c audio_play.c user_config.c alarm_config.c alarm_interval.c center.c property.c" ;;
    t5a) echo "libcallback_tier_stub.c setlinebuf.c freopen.c command.c video_callback.c video_control.c jpeg.c audio_callback.c audio_control.c audio_play.c user_config.c alarm_config.c alarm_interval.c center.c property.c mmc_format.c mmc_mount.c curl.c opendir.c remove.c motor.c gmtime_r.c" ;;
    t5b) echo "libcallback_tier_stub.c setlinebuf.c freopen.c command.c video_callback.c video_control.c jpeg.c audio_callback.c audio_control.c audio_play.c user_config.c alarm_config.c alarm_interval.c center.c property.c wait_motion.c night_light.c usb_power.c timelapse.c mp4write.c watermark.c get_jpeg.c" ;;
    full)
      awk -F= '/^CC_SRCS =/ {print $2; exit}' libcallback/Makefile | sed 's/#.*//' | tr -d '\r'
      ;;
    *) echo "unknown tier $1" >&2; return 1 ;;
  esac
}

build_one() {
  local tier=$1
  local srcs out
  srcs=$(tier_srcs "$tier")
  out="libcallback.f3-${tier}.so"
  cp libcallback/Makefile libcallback/Makefile.bak
  if [ "$tier" = "full" ]; then
  :
  elif [ "$tier" = "t0" ]; then
    cp "$STUB" libcallback/libcallback_tier_stub.c
    sed -i "s|^CC_SRCS =.*|CC_SRCS = libcallback_tier_stub.c|" libcallback/Makefile
  else
    cp "$STUB" libcallback/libcallback_tier_stub.c
    sed -i "s|^CC_SRCS =.*|CC_SRCS = ${srcs}|" libcallback/Makefile
  fi
  docker compose exec -T builder bash -lc \
    "export CROSS_BASE=/atomtools/build/cross/mips-uclibc; export CROSS_COMPILE=\${CROSS_BASE}/bin/mipsel-ingenic-linux-uclibc-; cd /src/libcallback; rm -f libcallback.so; make; cp -f libcallback.so /src/libcallback/${out}; md5sum /src/libcallback/${out}"
  cp libcallback/Makefile.bak libcallback/Makefile
  echo "built libcallback/${out}"
}

if [ "$TIER" = "all" ]; then
  for t in t0 t1 t2 t3 t4 t5 full; do build_one "$t"; done
else
  build_one "$TIER"
fi
