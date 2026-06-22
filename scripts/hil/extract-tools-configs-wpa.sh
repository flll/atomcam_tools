#!/usr/bin/env bash
# Extract wpa_supplicant.conf from tools_configs ext2 (debugfs, no mount).
set -euo pipefail

IMG="${1:-}"
if [[ -z "$IMG" || ! -f "$IMG" ]]; then
  echo "usage: $0 <tools_configs>" >&2
  exit 1
fi

CMD="$(mktemp)"
trap 'rm -f "$CMD"' EXIT
cat > "$CMD" <<'EOF'
ls /
ls /configs
ls /configs/etc
cat /configs/etc/wpa_supplicant.conf
quit
EOF

OUT="$(debugfs -f "$CMD" "$IMG" 2>/dev/null || true)"
WPA="$(printf '%s\n' "$OUT" | awk '/^debugfs: cat /{p=0} /^debugfs: quit/{exit} p; /^ctrl_interface=/{p=1; print}')"

if [[ -z "$WPA" ]]; then
  echo '{"error":"wpa_supplicant.conf not found in tools_configs"}'
  exit 10
fi

python3 - "$WPA" <<'PY'
import json, re, sys
wpa = sys.argv[1]
ssid_m = re.search(r'ssid="([^"]*)"', wpa)
psk_m = re.search(r'psk="([^"]*)"', wpa)
ssid = ssid_m.group(1) if ssid_m else ""
psk = psk_m.group(1) if psk_m else ""
def crlf_flags(s):
    return {
        "has_cr": "\r" in s,
        "has_lf_only": "\n" in s and "\r" not in s,
        "repr": repr(s)[:120],
    }
redacted = re.sub(r'(psk=")[^"]*(")', r'\1***\2', wpa)
redacted = re.sub(r'(TAILSCALE_AUTH_KEY=).*', r'\1***', redacted)
print(json.dumps({
    "size_bytes": len(wpa.encode()),
    "ssid": ssid.replace("\r", "\\r"),
    "ssid_diag": crlf_flags(ssid),
    "psk_set": bool(psk),
    "psk_diag": crlf_flags(psk),
    "has_network_block": "network={" in wpa,
    "wpa_redacted": redacted,
}, ensure_ascii=False))
PY
