#!/bin/bash
# webhook 分解(webhook.sh → webhook.awk + dispatcher)の旧新パリティテスト。
# 実機不要・lll-legacy 上で busybox(1.37, 実機と同系)を使って検証する。
#
# フェーズ:
#   A) イベントコーパスを旧 awk / 新 awk+dispatcher に流し、notify 呼び出し・
#      フック呼び出し・atom.log(タイムスタンプ正規化後)が一致することを確認
#   B) 1秒間に 2KB 超を流しレートリミッタ(Logging is suspended)が両者で発火
#   C) 単引用符入り data — 旧は system() のクォート破損、新は正しい argv(期待差分)
#   D) FIFO 実走 — writer close → respawn 1回 → 再送イベントが届く。
#      pkill -f webhook.awk で awk が確実に止まることも実証
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SB="$(mktemp -d)"
trap 'pkill -f "$SB" 2>/dev/null; sleep 1; rm -rf "$SB"' EXIT
mkdir -p "$SB/tmp/log" "$SB/scripts" "$SB/media/mmc" "$SB/dev"

PASS=0; FAIL=0
ok() { PASS=$((PASS + 1)); echo "  ok: $1"; }
ng() { FAIL=$((FAIL + 1)); echo "  NG: $1 — $2"; }

# --- スタブと設定 -------------------------------------------------------------
cat > "$SB/hack.ini" <<EOF
WEBHOOK_URL=http://example.invalid/hook
WEBHOOK_ALARM_EVENT=on
WEBHOOK_ALARM_INFO=on
WEBHOOK_TIMELAPSE_EVENT=on
MQTT_ENABLE=off
EOF
cat > "$SB/scripts/notify.sh" <<'EOF'
#!/bin/sh
# 区切りは US(0x1F)。busybox printf は \xHH 非対応のため八進 \037 を使う
printf '%s\037%s\n' "${1:-}" "${2:-}" >> "${NOTIFY_LOG:?}"
EOF
cat > "$SB/scripts/timelapse.sh" <<'EOF'
#!/bin/sh
printf 'timelapse.sh %s\n' "$*" >> "${HOOK_LOG:?}"
EOF
cat > "$SB/scripts/motor_init" <<'EOF'
#!/bin/sh
printf 'motor_init %s\n' "$*" >> "${HOOK_LOG:?}"
EOF
cat > "$SB/media/mmc/timelapse_hook.sh" <<'EOF'
#!/bin/sh
printf 'timelapse_hook.sh %s\n' "$*" >> "${HOOK_LOG:?}"
EOF
chmod +x "$SB/scripts/"* "$SB/media/mmc/timelapse_hook.sh"

rewrite() {
  sed -e "s|/tmp/|$SB/tmp/|g" \
      -e "s|/dev/console|$SB/dev/console|g" \
      -e "s|/scripts/|$SB/scripts/|g" \
      -e "s|/media/mmc/|$SB/media/mmc/|g"
}

# 旧: HEAD の webhook.sh から awk プログラム部を抽出
git show HEAD:overlay_rootfs/scripts/webhook.sh \
  | sed -n "/^awk -v/,/^' \/var\/run\/atomapp/p" | sed '1d;$d' \
  | rewrite > "$SB/prog.old.awk"
[ -s "$SB/prog.old.awk" ] || { echo "旧 awk プログラムの抽出に失敗" >&2; exit 2; }
# 新: 作業ツリーの webhook.awk
rewrite < overlay_rootfs/scripts/webhook.awk > "$SB/scripts/webhook.awk"

AWKV=(-v HACK_INI="$SB/hack.ini" -v ATOM_LOG=on -v TIMELAPSE_HOOK=on)
DISPATCH='TAB=$(printf "\t"); while IFS="$TAB" read -r ev data; do "'"$SB"'/scripts/notify.sh" "$ev" "$data"; done'

run_old() { NOTIFY_LOG="$1" HOOK_LOG="$2" busybox awk "${AWKV[@]}" -f "$SB/prog.old.awk" "$3"; }
run_new() { NOTIFY_LOG="$1" HOOK_LOG="$2" busybox awk "${AWKV[@]}" -f "$SB/scripts/webhook.awk" "$3" \
              | NOTIFY_LOG="$1" busybox ash -c "$DISPATCH"; }

reset_logs() { rm -f "$SB/tmp/log/atom.log" "$SB/tmp/motor_initialize_done" "$SB/dev/console"; }
norm_log() { sed -E 's|[0-9]{4}/[0-9]{2}/[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}|TS|' "$1"; }

echo "== A) イベントコーパスのパリティ =="
cat > "$SB/events.txt" <<'EOF'
[aiAlgo] start
alarm_event_handle xxx timestamp 1234
alarm_event_handle == readly to alarm ==
[aiAlgo] call_TD_Human_Pet_Predict [off:123] tm:1|2 res:[0.9]
alarm_event_handle foo alarmType:person
[webhook] time_lapse_event tl1 3/10 5
[webhook] time_lapse_finish /media/mmc/time_lapse/x.mp4
motor reset done.
random noise line without any event
EOF
reset_logs
run_old "$SB/calls.old" "$SB/hooks.old" "$SB/events.txt"; sleep 1
mv "$SB/tmp/log/atom.log" "$SB/atom.log.old"
OLD_MOTOR=0; [ -f "$SB/tmp/motor_initialize_done" ] && OLD_MOTOR=1
reset_logs
run_new "$SB/calls.new" "$SB/hooks.new" "$SB/events.txt"; sleep 1
mv "$SB/tmp/log/atom.log" "$SB/atom.log.new"
NEW_MOTOR=0; [ -f "$SB/tmp/motor_initialize_done" ] && NEW_MOTOR=1

diff -q "$SB/calls.old" "$SB/calls.new" >/dev/null \
  && ok "notify 呼び出し一致 ($(wc -l < "$SB/calls.new")件)" \
  || ng "notify 呼び出し" "$(diff "$SB/calls.old" "$SB/calls.new" | head -5)"
{ sort "$SB/hooks.old" > "$SB/hooks.old.s"; sort "$SB/hooks.new" > "$SB/hooks.new.s"; }
diff -q "$SB/hooks.old.s" "$SB/hooks.new.s" >/dev/null \
  && ok "フック呼び出し一致 ($(wc -l < "$SB/hooks.new")件)" \
  || ng "フック呼び出し" "$(diff "$SB/hooks.old.s" "$SB/hooks.new.s" | head -5)"
diff -q <(norm_log "$SB/atom.log.old") <(norm_log "$SB/atom.log.new") >/dev/null \
  && ok "atom.log 一致(正規化後)" \
  || ng "atom.log" "$(diff <(norm_log "$SB/atom.log.old") <(norm_log "$SB/atom.log.new") | head -5)"
[ "$OLD_MOTOR" = "$NEW_MOTOR" ] && [ "$NEW_MOTOR" = 1 ] \
  && ok "motor_initialize_done 両方生成" || ng "motor_initialize_done" "old=$OLD_MOTOR new=$NEW_MOTOR"

echo "== B) レートリミッタ発火 =="
mkbig() { { echo "warmup line"; sleep 1; for i in $(seq 1 30); do
  printf 'noise %04d %s\n' "$i" "0123456789012345678901234567890123456789012345678901234567890123"; done
  sleep 1; echo "tail line"; } }
reset_logs
mkbig | run_old "$SB/calls.b.old" "$SB/hooks.b.old" -
grep -q "Logging is suspended" "$SB/tmp/log/atom.log" && OLD_SUSP=1 || OLD_SUSP=0
reset_logs
mkbig | run_new "$SB/calls.b.new" "$SB/hooks.b.new" -
grep -q "Logging is suspended" "$SB/tmp/log/atom.log" && NEW_SUSP=1 || NEW_SUSP=0
[ "$OLD_SUSP" = 1 ] && [ "$NEW_SUSP" = 1 ] \
  && ok "リミッタ両方発火 (suspended)" || ng "リミッタ" "old=$OLD_SUSP new=$NEW_SUSP"

echo "== C) 単引用符入り data(期待差分=修正) =="
echo "alarm_event_handle foo alarmType:pe'rson" > "$SB/quote.txt"
reset_logs
run_old "$SB/calls.q.old" "$SB/hooks.q.old" "$SB/quote.txt" 2>/dev/null
reset_logs
run_new "$SB/calls.q.new" "$SB/hooks.q.new" "$SB/quote.txt"
WANT_Q="$(printf 'recognitionNotify\037"pe'"'"'rson"')"
NEW_Q="$(cat "$SB/calls.q.new" 2>/dev/null || true)"
OLD_Q="$(cat "$SB/calls.q.old" 2>/dev/null || true)"
[ "$NEW_Q" = "$WANT_Q" ] && ok "新: 単引用符 data が正しい argv で届く" \
  || ng "新 quote" "got: $NEW_Q"
[ "$OLD_Q" != "$WANT_Q" ] && ok "旧: クォート破損を確認(期待差分。old=[${OLD_Q}])" \
  || ng "旧 quote" "旧も一致してしまった(期待と異なる)"

echo "== D) FIFO 実走: respawn + pkill =="
WRAP="$SB/webhook.rw.sh"
rewrite < overlay_rootfs/scripts/webhook.sh \
  | sed -e "s|/var/run/atomapp|$SB/fifo|" -e "s|sleep 2|sleep 1|" > "$WRAP"
# ラッパーは HACK_INI を /tmp/hack.ini(rewrite 後 $SB/tmp/hack.ini)から読む
cp "$SB/hack.ini" "$SB/tmp/hack.ini"
mkfifo "$SB/fifo"
NOTIFY_LOG="$SB/calls.fifo" HOOK_LOG="$SB/hooks.fifo" busybox ash "$WRAP" >/dev/null 2>&1 &
WPID=$!
sleep 1
exec 3>"$SB/fifo"; printf '[aiAlgo] start\n' >&3; exec 3>&-   # writer close → EOF → respawn
sleep 3
exec 3>"$SB/fifo"; printf '[aiAlgo] start\n' >&3; exec 3>&-   # respawn 後の2発目
sleep 3
N_ALARM="$(grep -c '^alarmEvent' "$SB/calls.fifo" 2>/dev/null | head -1)"
[ -z "$N_ALARM" ] && N_ALARM=0
[ "$N_ALARM" -eq 2 ] && ok "FIFO respawn 実証 (alarmEvent 2/2 到達)" \
  || ng "FIFO respawn" "alarmEvent=$N_ALARM (want 2)"
kill "$WPID" 2>/dev/null
pkill -f "$SB/scripts/webhook.awk" 2>/dev/null
pkill -f "$WRAP" 2>/dev/null
sleep 1
if pgrep -f "$SB/scripts/webhook.awk" >/dev/null 2>&1; then
  ng "pkill 実効性" "awk が残存"
else
  ok "pkill -f webhook.awk で awk 停止を確認"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "webhook-parity: PASS (${PASS} assertions)"
  exit 0
fi
echo "webhook-parity: FAIL (${FAIL} failed / ${PASS} passed)" >&2
exit 1
