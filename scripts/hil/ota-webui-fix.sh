#!/bin/bash
# HTTP OTA で web-new UI を実機へ配信（SSH 不要）
# 使い方: bash scripts/hil/ota-webui-fix.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec python3 /tmp/ota-webui-fix.py
