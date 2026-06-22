#!/bin/sh
LOG=/media/mmc/wifi_audit.log
TS=$(date "+%Y/%m/%d %H:%M:%S")
echo "===== $TS wifi_audit =====" >> "$LOG"
awk '{print $1}' /proc/uptime >> "$LOG" 2>&1
ifconfig >> "$LOG" 2>&1
TARGET=$(awk -F"\"" '/ssid=/{print $2; exit}' /media/mmc/wpa_supplicant.conf 2>/dev/null)
if ! pidof wpa_supplicant >/dev/null 2>&1; then
  echo "--- start wpa_supplicant (was not running) ---" >> "$LOG"
  WPA=/media/mmc/wpa_supplicant.conf
  [ -f "$WPA" ] || WPA=/configs/etc/wpa_supplicant.conf
  echo "--- wpa_conf=$WPA ---" >> "$LOG"
  wpa_supplicant -f /tmp/log/wpa_supplicant.log -D nl80211 -i wlan0 -c "$WPA" -B >> "$LOG" 2>&1
  sleep 3
fi
pidof wpa_supplicant >> "$LOG" 2>&1 || echo "wpa_supplicant_not_running" >> "$LOG"
echo "--- wpa_cli scan target=$TARGET ---" >> "$LOG"
wpa_cli -i wlan0 scan >> "$LOG" 2>&1
sleep 3
wpa_cli -i wlan0 scan_results >> "$LOG" 2>&1
wpa_cli -i wlan0 status >> "$LOG" 2>&1
if [ -n "$TARGET" ]; then
  if wpa_cli -i wlan0 scan_results 2>/dev/null | grep -F "$TARGET" >> "$LOG"; then
    echo "TARGET_SSID_SEEN" >> "$LOG"
  else
    echo "TARGET_SSID_NOT_SEEN" >> "$LOG"
  fi
fi
echo "--- wpa_supplicant.log tail ---" >> "$LOG"
tail -20 /tmp/log/wpa_supplicant.log >> "$LOG" 2>&1
echo "--- route ping ---" >> "$LOG"
route -n >> "$LOG" 2>&1
ROUTER=$(ip route 2>/dev/null | awk '/default/ {print $3}')
[ -n "$ROUTER" ] && ping -c 1 -W 2 "$ROUTER" >> "$LOG" 2>&1
sync
