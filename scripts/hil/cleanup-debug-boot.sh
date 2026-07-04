#!/bin/bash
# cleanup-debug-boot.sh — SD ブートストラップ(-DebugBoot)が実機に残した debug 資産を冪等に撤去する。
#
# 背景(2026-07-04 判明): S20mountfs が /media/mmc/atom_init.fixed(nopreload デバッグ版)と
# S61atomcam.fixed を bind mount で正規版に上書きし、set_crontab.sh が /media/mmc/crontab
# (wifi_audit 毎分実行)を無条件マージするため、正規ビルド deploy 済みでも LD_PRELOAD 喪失
# (見かけの F-3)と SD 逼迫が続く。詳細: docs/development/refactor-notes.md
#
# 使い方: [DRY_RUN=0] scripts/hil/cleanup-debug-boot.sh [HOST]
#   HOST     省略時 $ATOMCAM_HOST → atomcam.local
#   DRY_RUN  既定 1(変更なし・撤去対象の表示のみ)。0 で実行
#
# 方針:
#   - 削除はしない。/media/mmc/debug-archive-<ts>/ へ mv(復元は mv で戻すだけ)
#   - 実行中の wdkeep.sh(HW ウォッチドッグ給餌)は殺さない — 給餌停止は HW リセットを招く。
#     mv しても実行中プロセスは inode を掴んでおり無害。crontab 再生成で次回から湧かない
#   - reboot はしない。呼び出し側で make deploy-test 等により再起動すること
#     (LD_PRELOAD 復活は再起動後に有効)
# exit: 0=完了(DRY_RUN 含む) / 1=接続不可 / 2=検証失敗(debug crontab 行が残存)

set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOST="${1:-${ATOMCAM_HOST:-atomcam.local}}"
DRY_RUN="${DRY_RUN:-1}"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$ROOT/sim-results/perf/cleanup-debug-boot-$TS"
ARCHIVE="/media/mmc/debug-archive-$TS"

# -DebugBoot が /media/mmc に置く資産(存在するものだけ処理)
DEBRIS="atom-debug atom-log atom_init.fixed S61atomcam.fixed atom_init.f3test.fixed atom_init.fixed.bak-f3test crontab crontab.n wifi_audit.sh tailscale_wrapper.sh wdkeep.sh wdkeep_ensure.sh killwebhook.sh hil_boot_capture.sh hil_boot_capture.ndjson debug-6ef2a6.ndjson tailscaled.state"
BIGLOGS="wifi_audit.log tools.log"
BIND_TARGETS="/atom_patch/system_bin/atom_init.sh /etc/init.d/S61atomcam /atom/tmp/system/bin/atom_init.sh"

remote() { ssh -n -o BatchMode=yes -o ConnectTimeout=10 "root@${HOST}" "$@"; }

remote 'true' || { echo "ERROR: $HOST unreachable"; exit 1; }
mkdir -p "$OUT"

state() {
  remote 'for f in '"$DEBRIS $BIGLOGS"'; do
    if [ -e "/media/mmc/$f" ]; then
      s=$(wc -c < "/media/mmc/$f" | tr -d " ")
      printf "{\"file\":\"%s\",\"exists\":true,\"size\":%s}\n" "$f" "$s"
    else
      printf "{\"file\":\"%s\",\"exists\":false}\n" "$f"
    fi
  done' > "$OUT/state-$1.ndjson"
  remote 'crontab -l' > "$OUT/crontab-$1.txt" 2>&1 || true
  remote 'mount' > "$OUT/mount-$1.txt" 2>&1 || true
}

echo "== cleanup-debug-boot: host=$HOST dry_run=$DRY_RUN"
state before

if [ "$DRY_RUN" = "1" ]; then
  echo "-- DRY_RUN: 撤去対象(存在するもののみ) --"
  grep '"exists":true' "$OUT/state-before.ndjson" || echo "(なし — 撤去済み)"
  echo "-- bind mount 状態 --"
  grep -E 'atom_init|S61atomcam' "$OUT/mount-before.txt" || echo "(bind なし)"
  echo "-- 記録: $OUT"
  echo "DRY_RUN=0 $0 $HOST で実行"
  exit 0
fi

# 1) bind 解除(EBUSY 等で失敗しても続行 — mv は inode 単位で安全、次回 boot から bind されない)
for t in $BIND_TARGETS; do
  remote "umount '$t' 2>/dev/null && echo 'umount: $t' || echo 'umount skip(未マウント/EBUSY): $t'"
done

# 2) 残骸を SD 上のアーカイブへ mv(冪等)
remote "mkdir -p '$ARCHIVE'"
for f in $DEBRIS; do
  remote "if [ -e '/media/mmc/$f' ]; then mv '/media/mmc/$f' '$ARCHIVE/' && echo 'archived: $f'; fi"
done

# 3) 巨大ログ: 末尾 200KB を手元に回収してから削除
for f in $BIGLOGS; do
  if remote "[ -e '/media/mmc/$f' ]"; then
    remote "tail -c 204800 '/media/mmc/$f'" > "$OUT/${f%.log}.tail.log" 2>/dev/null || true
    remote "rm -f '/media/mmc/$f'" && echo "removed: $f (tail 200KB -> $OUT/${f%.log}.tail.log)"
  fi
done

# 4) crontab 再生成 → debug 行の消滅を検証
remote '/scripts/set_crontab.sh' || echo 'WARN: set_crontab.sh 失敗'
state after
if grep -qE 'wifi_audit|tailscale_wrapper|killwebhook|wdkeep' "$OUT/crontab-after.txt"; then
  echo "NG: debug crontab 行が残存 — $OUT/crontab-after.txt を確認"
  exit 2
fi
echo "OK: crontab から debug 行消滅"
echo "== 完了。実機アーカイブ: $ARCHIVE / 記録: $OUT"
echo "次: make deploy-test ATOMCAM_HOST=$HOST(再起動で LD_PRELOAD 復活を確認)"
