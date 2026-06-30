#!/bin/bash
# F-3: build libcallback variants for preload testing on /media/mmc/libcallback.so
# Usage: ./scripts/hil/build_libcallback_f3.sh [noscan|trace]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VARIANT="${1:-trace}"
cd "$ROOT"
cp libcallback/Makefile libcallback/Makefile.bak
case "$VARIANT" in
  noscan)
    sed -i 's/ user_config.c alarm_interval.c alarm_config.c center.c property.c / alarm_interval.c center.c /' libcallback/Makefile
    OUT=libcallback.f3-noscan.so
    ;;
  trace)
    sed -i 's/ user_config.c alarm_interval.c alarm_config.c center.c property.c / alarm_interval.c center.c property.c /' libcallback/Makefile
    OUT=libcallback.f3-trace.so
    ;;
  *)
    echo "usage: $0 [noscan|trace]" >&2
    exit 1
    ;;
esac
docker compose exec -T builder bash -lc "export CROSS_BASE=/atomtools/build/cross/mips-uclibc; export CROSS_COMPILE=\${CROSS_BASE}/bin/mipsel-ingenic-linux-uclibc-; cd /src/libcallback; rm -f libcallback.so; make; cp -f libcallback.so /src/libcallback/${OUT}; md5sum /src/libcallback/${OUT}"
cp libcallback/Makefile.bak libcallback/Makefile
echo "built libcallback/${OUT}"

