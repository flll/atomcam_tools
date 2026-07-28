#!/bin/bash
# cmd.cgi の旧新 A/B パリティテスト(実機不要・lll-legacy 上で実行)。
#
# 方式: 旧版(git show HEAD:...)と新版(作業ツリー)の両方に sed で絶対パスを
# サンドボックスへ書き換えて busybox ash で実行し、stdout を diff する。
# 期待差分は「POST port=socket&t=1」の1件のみ(旧: PORT に &t=1 が残り webcmd 経路へ
# 誤流入 / 新: socket 経路 = バグ修正の証明)。それ以外は全ケース diff=0。
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

CGI=overlay_rootfs/var/www/cgi-bin/cmd.cgi
SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT

# --- サンドボックス構築 -------------------------------------------------------
mkdir -p "$SB/bin" "$SB/tmp" "$SB/proc" "$SB/var/run" "$SB/scripts" \
         "$SB/atom/configs" "$SB/media/mmc/record" "$SB/media/mmc/alarm_record" \
         "$SB/media/mmc/time_lapse"

cat > "$SB/proc/swaps" <<EOF
Filename				Type		Size		Used		Priority
/media/mmc/swap                         file		131068		0		-2
EOF
cat > "$SB/proc/meminfo" <<EOF
MemTotal:          87708 kB
MemFree:            3412 kB
Cached:            36804 kB
EOF
cat > "$SB/atom/configs/.user_config" <<EOF
slide_x=1000
slide_y=500
horSwitch=1
verSwitch=0
EOF
echo '{"channel":"webhook","ok":true}' > "$SB/tmp/webhook_status.sample"
printf 'OK\n' > "$SB/var/run/webres"

cat > "$SB/bin/nc" <<'EOF'
#!/bin/sh
line=""
while IFS= read -r l; do line="$l"; done
case "$line" in
  timelapse) echo off ;;
  center) echo done ;;
  "video flip") echo 0 ;;
  move) echo "10.500000 20.500000 1 0 0" ;;
  *) echo "SOCK:$line" ;;
esac
EOF
cat > "$SB/bin/curl" <<'EOF'
#!/bin/sh
printf 'https://github.com/flll/atomcam_tools/releases/tag/Ver.9.9.9'
EOF
cat > "$SB/bin/df" <<'EOF'
#!/bin/sh
echo "Filesystem           1K-blocks      Used Available Use% Mounted on"
echo "/dev/mmcblk0p1        15465472   7593696   7871184  50% /media/mmc"
EOF
cat > "$SB/bin/du" <<'EOF'
#!/bin/sh
printf '1234\t%s\n' "$2"
EOF
cat > "$SB/bin/date" <<'EOF'
#!/bin/sh
echo "2026/07/29 00:00:00"
EOF
cat > "$SB/scripts/notify.sh" <<'EOF'
#!/bin/sh
echo '{"channel":"test","ok":true,"at":"2026-07-29T00:00:00"}'
EOF
cat > "$SB/scripts/tailscale.sh" <<'EOF'
#!/bin/sh
echo '{"state":"stopped"}'
EOF
chmod +x "$SB/bin/"* "$SB/scripts/"*

# --- 旧新スクリプトの取り出しとパス書き換え -----------------------------------
# 旧版 = case 化+POST バグ修正(bf5b71f)の直前に固定。コミット後も移行検証を再現できる
OLD_REF="${CMD_CGI_OLD_REF:-bf5b71f~1}"
git show "$OLD_REF:$CGI" > "$SB/old.cgi.orig"
cp "$CGI" "$SB/new.cgi.orig"
for v in old new; do
  sed -e "s|/tmp/|$SB/tmp/|g" \
      -e "s|/proc/|$SB/proc/|g" \
      -e "s|/atom/configs|$SB/atom/configs|g" \
      -e "s| /media/mmc | $SB/media/mmc |g" \
      -e "s|\"/media/mmc/|\"$SB/media/mmc/|g" \
      -e "s|-k /media/mmc|-k $SB/media/mmc|g" \
      -e "s|/var/run/|$SB/var/run/|g" \
      -e "s|/scripts/|$SB/scripts/|g" \
      -e "s|/usr/bin/nc|$SB/bin/nc|g" \
      "$SB/$v.cgi.orig" > "$SB/$v.cgi"
done

# --- ケース実行 ---------------------------------------------------------------
PASS=0; FAIL=0; EXPECTED_DIFF=0
run_case() {
  # run_case LABEL METHOD QS MOTOR MOUNTED WHSTATUS [BODY]
  local label="$1" method="$2" qs="$3" motor="$4" mounted="$5" whstatus="$6" body="${7:-}"
  [ "$motor" = "1" ] && touch "$SB/tmp/motor_initialize_done" || rm -f "$SB/tmp/motor_initialize_done"
  if [ "$mounted" = "1" ]; then
    printf '/dev/mmcblk0p1 %s/media/mmc vfat rw,noatime 0 0\n' "$SB" > "$SB/proc/mounts"
  else
    printf '/dev/root / squashfs ro 0 0\n' > "$SB/proc/mounts"
  fi
  [ "$whstatus" = "1" ] && cp "$SB/tmp/webhook_status.sample" "$SB/tmp/webhook_status" \
                        || rm -f "$SB/tmp/webhook_status"
  local out_old out_new
  for v in old new; do
    : > "$SB/var/run/webcmd"
    if [ "$method" = "POST" ]; then
      printf '%s' "$body" | REQUEST_METHOD="$method" QUERY_STRING="$qs" \
        PATH="$SB/bin:$PATH" busybox ash "$SB/$v.cgi" > "$SB/$v.out" 2>"$SB/$v.err"
    else
      REQUEST_METHOD="$method" QUERY_STRING="$qs" \
        PATH="$SB/bin:$PATH" busybox ash "$SB/$v.cgi" > "$SB/$v.out" 2>"$SB/$v.err" </dev/null
    fi
    cp "$SB/var/run/webcmd" "$SB/$v.webcmd"
  done
  if diff -q "$SB/old.out" "$SB/new.out" >/dev/null && diff -q "$SB/old.webcmd" "$SB/new.webcmd" >/dev/null; then
    PASS=$((PASS + 1)); echo "  identical: $label"
  else
    case "$label" in
      *expected-diff*)
        EXPECTED_DIFF=$((EXPECTED_DIFF + 1))
        echo "  expected-diff: $label"
        echo "    old stdout: $(cat "$SB/old.out") / old webcmd: $(cat "$SB/old.webcmd")"
        echo "    new stdout: $(cat "$SB/new.out") / new webcmd: $(cat "$SB/new.webcmd")"
        ;;
      *)
        FAIL=$((FAIL + 1)); echo "  DIFF(NG): $label"
        diff "$SB/old.out" "$SB/new.out" | head -10 | sed 's/^/    /'
        ;;
    esac
  fi
}

BODY='{"exec":"property"}'
run_case "GET name空(motor未初期化)"        GET ""                 0 1 1
run_case "GET name空(motor初期化済)"        GET ""                 1 1 1
run_case "GET name空+t付き"                 GET "t=999"            0 1 1
run_case "GET latest-ver"                   GET "name=latest-ver"  0 1 1
run_case "GET status(motor未初期化)"        GET "name=status"      0 1 1
run_case "GET status(motor初期化済)"        GET "name=status"      1 1 1
run_case "GET status&t=123"                 GET "name=status&t=123" 0 1 1
run_case "GET media-size"                   GET "name=media-size"  0 1 1
run_case "GET storage-info(mount有)"        GET "name=storage-info" 0 1 1
run_case "GET storage-info(mount無)"        GET "name=storage-info" 0 0 1
run_case "GET storage-du"                   GET "name=storage-du"  0 1 1
run_case "GET notify-test"                  GET "name=notify-test" 0 1 1
run_case "GET notify-status(有)"            GET "name=notify-status" 0 1 1
run_case "GET notify-status(無)"            GET "name=notify-status" 0 1 0
run_case "GET tailscale-status"             GET "name=tailscale-status" 0 1 1
run_case "GET 未知name"                     GET "name=nosuch"      0 1 1
run_case "GET 未知name&t"                   GET "name=nosuch&t=1"  0 1 1
run_case "POST port=socket"                 POST "port=socket"     0 1 1 "$BODY"
run_case "POST port空(webcmd経路)"          POST ""                0 1 1 "$BODY"
run_case "POST port=socket&t=1 (expected-diff: 旧はwebcmd誤流入)" POST "port=socket&t=1" 0 1 1 "$BODY"

echo ""
TOTAL=$((PASS + FAIL + EXPECTED_DIFF))
if [ "$FAIL" -eq 0 ] && [ "$EXPECTED_DIFF" -eq 1 ]; then
  echo "cmd-cgi-test: ${PASS}/${TOTAL} identical, 1 expected-diff (POST port=socket&t=1: bug fixed), PASS"
  exit 0
fi
echo "cmd-cgi-test: FAIL (identical=${PASS}, unexpected-diff=${FAIL}, expected-diff=${EXPECTED_DIFF})" >&2
exit 1
