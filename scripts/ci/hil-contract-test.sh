#!/bin/bash
# HIL 契約テスト — deploy_remote.sh / smoke_test_remote.sh の外部契約を実機なしで検証する。
#
# 検証する契約:
#   - exit code: 0=成功 / 10=転送失敗 / 30=版不一致 (20=boot timeout は時間がかかるため対象外)
#   - stdout 最終行の NDJSON: {"action","host","from","to","elapsed_s","result"}
#   - smoke の全ケース NDJSON が jq でパース可能・ケース集合が期待どおり
#   - history.ndjson への1実行=1行追記(キー: run/timestamp/…)
#
# 方式: PATH 先頭に偽 ssh/scp/ping/curl/nc を置き、到達系のフルパスを再現する。
# usage: scripts/ci/hil-contract-test.sh   (lll-legacy 上で実行)
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

command -v jq >/dev/null 2>&1 || { echo "jq が必要です" >&2; exit 2; }

TD="$(mktemp -d)"
trap 'rm -rf "$TD"' EXIT
export CONTRACT_STATE="$TD/state"
mkdir -p "$CONTRACT_STATE" "$TD/bin"

EXPECTED="$(tr -d '[:space:]' < configs/atomhack.ver)"
printf 'Ver.OLD\n' > "$CONTRACT_STATE/ver.before"
printf '%s\n' "$EXPECTED" > "$CONTRACT_STATE/ver.after"

# --- 偽コマンド群 -------------------------------------------------------------
cat > "$TD/bin/ssh" <<'STUB'
#!/bin/bash
# root@HOST 以降の引数をリモートコマンド文字列として扱う
cmd=""; seen=0
for a in "$@"; do
  if [ "$seen" -eq 1 ]; then cmd="$cmd $a"; continue; fi
  case "$a" in root@*) seen=1 ;; esac
done
cmd="${cmd# }"
S="${CONTRACT_STATE:?}"
case "$cmd" in
  "echo ok") echo ok ;;
  "cat /etc/atomhack.ver 2>/dev/null")
    if [ -f "$S/rebooted" ]; then cat "$S/ver.after"; else cat "$S/ver.before"; fi ;;
  "uptime") echo " 12:00:00 up 1 day, load average: 0.10, 0.10, 0.10" ;;
  *"pidof iCamera_app"*) echo 123 ;;
  "test -f /media/mmc/atom-debug && echo yes || echo no") echo no ;;
  "test -s /tmp/hack.ini && echo yes || echo no") echo yes ;;
  "/scripts/cmd audio 2>&1 | head -1") echo "audio ok" ;;
  "sync") : ;;
  "sync; reboot") touch "$S/rebooted" ;;
  "["*rootfs_hack.squashfs*"mkdir -p /media/mmc/update") : ;;
  *atomhack.log*"grep -ciE"*) echo 0 ;;
  "grep -c libcallback /proc/123/maps 2>/dev/null") echo 3 ;;
  *"/^RTSP"*) echo off ;;
  *TAILSCALE_ENABLE*) echo off ;;
  *WEBRTC_ENABLE*) echo off ;;
  *"free | awk"*) echo 20480 ;;
  *boot_timeline*) : ;;
  *loadavg*) echo 0.50 ;;
  *diskstats*) echo 1000 ;;
  *) : ;;
esac
exit 0
STUB
cat > "$TD/bin/scp" <<'STUB'
#!/bin/bash
[ -f "${CONTRACT_STATE:?}/scp_fail" ] && exit 1
exit 0
STUB
cat > "$TD/bin/ping" <<'STUB'
#!/bin/bash
exit 0
STUB
cat > "$TD/bin/nc" <<'STUB'
#!/bin/bash
exit 1
STUB
cat > "$TD/bin/curl" <<'STUB'
#!/bin/bash
url=""; head=0; wfmt=""
args=("$@")
for i in "${!args[@]}"; do
  case "${args[$i]}" in
    http*) url="${args[$i]}" ;;
    -sfI|-I) head=1 ;;
    -w) wfmt="${args[$((i+1))]}" ;;
  esac
done
case "$url" in
  *hack_ini.cgi*) echo '{}' ;;
  */assets/*.css*)
    if [ "$head" -eq 1 ]; then printf 'HTTP/1.1 200 OK\r\nContent-Type: text/css\r\n\r\n'
    else printf 'css'; fi ;;
  */assets/*.js*) [ -n "$wfmt" ] && printf '200' ;;
  *)
    if [ -n "$wfmt" ]; then printf '200'
    elif [ "$head" -eq 1 ]; then printf 'HTTP/1.1 200 OK\r\n\r\n'
    else printf '<html><head><link rel="stylesheet" href="./assets/index-abc.css"></head><body><script type="module" src="/assets/index-abc.js"></script></body></html>\n'
    fi ;;
esac
exit 0
STUB
chmod +x "$TD/bin/"*
export PATH="$TD/bin:$PATH"
export HIL_HISTORY_FILE="$TD/history.ndjson"

PASS=0; FAIL=0
ok() { PASS=$((PASS + 1)); echo "  ok: $1"; }
ng() { FAIL=$((FAIL + 1)); echo "  NG: $1 — $2"; }

expect_rc_result() {  # LABEL WANT_RC WANT_RESULT GOT_RC OUT_FILE
  local last; last="$(grep -E '^\{' "$5" | tail -1)"
  if [ "$4" -eq "$2" ] && [ "$(echo "$last" | jq -r .result)" = "$3" ]; then
    ok "$1 (rc=$4, result=$3)"
  else
    ng "$1" "rc=$4(want $2), last=$last"
  fi
}

echo "== S1: deploy --status (到達・iCamera 稼働) =="
./scripts/deploy_remote.sh contract-stub --status > "$TD/s1.out" 2>&1; rc=$?
expect_rc_result "status ok" 0 ok "$rc" "$TD/s1.out"

echo "== S2: deploy --squashfs-only (版一致で成功) =="
rm -f "$CONTRACT_STATE/rebooted"
./scripts/deploy_remote.sh contract-stub --squashfs-only > "$TD/s2.out" 2>&1; rc=$?
expect_rc_result "deploy ok" 0 ok "$rc" "$TD/s2.out"
last="$(grep -E '^\{' "$TD/s2.out" | tail -1)"
[ "$(echo "$last" | jq -r .to)" = "$EXPECTED" ] && ok "deploy to=$EXPECTED" || ng "deploy to" "$last"

echo "== S3: deploy --squashfs-only (版不一致 → 30) =="
rm -f "$CONTRACT_STATE/rebooted"
printf 'Ver.BAD\n' > "$CONTRACT_STATE/ver.after"
./scripts/deploy_remote.sh contract-stub --squashfs-only > "$TD/s3.out" 2>&1; rc=$?
expect_rc_result "deploy mismatch" 30 mismatch "$rc" "$TD/s3.out"
printf '%s\n' "$EXPECTED" > "$CONTRACT_STATE/ver.after"

echo "== S4: deploy --squashfs-only (scp 失敗 → 10) =="
rm -f "$CONTRACT_STATE/rebooted"; touch "$CONTRACT_STATE/scp_fail"
./scripts/deploy_remote.sh contract-stub --squashfs-only > "$TD/s4.out" 2>&1; rc=$?
expect_rc_result "deploy transfer-fail" 10 transfer-fail "$rc" "$TD/s4.out"
rm -f "$CONTRACT_STATE/scp_fail"

echo "== S5: smoke (到達・全ケース) =="
rm -f "$CONTRACT_STATE/rebooted"; touch "$CONTRACT_STATE/rebooted"   # 版一致状態
SMOKE_RUN_DIR="$TD/smoke-run" ./scripts/smoke_test_remote.sh contract-stub "$EXPECTED" > "$TD/s5.out" 2>&1; rc=$?
[ "$rc" -eq 0 ] && ok "smoke rc=0" || ng "smoke rc" "rc=$rc: $(cat "$TD/s5.out")"
badjson=0
while IFS= read -r line; do
  echo "$line" | jq -e . >/dev/null 2>&1 || { badjson=1; ng "json parse" "$line"; }
done < <(grep -E '^\{' "$TD/s5.out")
[ "$badjson" -eq 0 ] && ok "smoke 全行 JSON valid"
CASES="$(grep -E '^\{' "$TD/s5.out" | jq -r .case | tr '\n' ' ')"
WANT="version icamera preload webui_spa webui_css webui rtsp tailscale go2rtc resources perf "
[ "$CASES" = "$WANT" ] && ok "smoke ケース集合一致" || ng "smoke ケース集合" "got: $CASES"
VERRES="$(grep -E '^\{' "$TD/s5.out" | jq -r 'select(.case=="version") | .result')"
[ "$VERRES" = "pass" ] && ok "version pass" || ng "version" "$VERRES"

echo "== S6: history.ndjson 契約 =="
HLINES="$(wc -l < "$HIL_HISTORY_FILE")"
[ "$HLINES" -eq 5 ] && ok "history 5行(=5実行)" || ng "history 行数" "$HLINES"
jq -e '.run and .timestamp and .result' "$HIL_HISTORY_FILE" >/dev/null 2>&1 \
  && ok "history キー契約" || ng "history キー" "$(tail -1 "$HIL_HISTORY_FILE")"

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "hil-contract: PASS (${PASS} assertions)"
  exit 0
fi
echo "hil-contract: FAIL (${FAIL} failed / ${PASS} passed)" >&2
exit 1
