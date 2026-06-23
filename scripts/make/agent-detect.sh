#!/usr/bin/env bash
# Detect Cursor / agent CLI; offer shell wizard when absent.
set -euo pipefail

BANNER=0
for arg in "$@"; do
  [ "$arg" = "--banner" ] && BANNER=1
done

agent_kind="none"
agent_detail=""

if [ -n "${CURSOR_AGENT:-}" ] || [ -n "${CURSOR_TRACE_ID:-}" ]; then
  agent_kind="cursor-session"
  agent_detail="Cursor agent session env detected"
elif command -v cursor >/dev/null 2>&1; then
  agent_kind="cursor-cli"
  agent_detail="cursor CLI: $(command -v cursor)"
fi

if [ "$BANNER" -eq 1 ]; then
  if [ "$agent_kind" = "none" ]; then
    cat <<'EOF'
[Codex] Cursor エージェントは検出されませんでした。
      make configure で対話式に PROFILE を選べます（エージェント不要）。
      Cursor を使う場合はチャットで「PROFILE=harness で build」と依頼してください。
EOF
  else
    echo "[Codex] Cursor エージェント検出: $agent_kind ($agent_detail)"
    echo "      チャットで PROFILE を指定するか make build PROFILE=... を使えます。"
  fi
fi

echo "AGENT_KIND=$agent_kind"
echo "AGENT_DETAIL=$agent_detail"
