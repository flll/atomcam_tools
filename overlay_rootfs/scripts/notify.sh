#!/bin/sh
# notify.sh — イベント通知の送信口(WebHook + MQTT)を1か所に集約する。
# webhook.sh から呼ばれ、cmd.cgi のテスト送信・HA MQTT Discovery もここで賄う。
# 依存は curl のみ(この機は curl 8.19 が mqtt プロトコル対応=mosquitto 不要)。
#
# 使い方:
#   notify.sh <event> [dataJson]   イベントを webhook/MQTT へ送る(dataJson は JSON 値)
#   notify.sh --test               テストイベントを送り、結果 JSON を stdout に出す
#   notify.sh --discovery          HA MQTT Discovery 設定を retain publish する
#
# 最後の送信結果は /tmp/webhook_status に JSON 1行で残す(WebUI が cmd.cgi 経由で読む)。

HACK_INI=/tmp/hack.ini
STATUS=/tmp/webhook_status
get() { awk -F= "/^$1 *=/ {sub(/^[^=]*=/,\"\"); print; exit}" "$HACK_INI"; }

HOSTNAME=$(hostname)
NODE=$(echo "$HOSTNAME" | sed 's/[^a-zA-Z0-9_]/_/g')

WEBHOOK_URL=$(get WEBHOOK_URL)
[ "$(get WEBHOOK_INSECURE)" = "on" ] && INSECURE="-k" || INSECURE=""
MQTT_ENABLE=$(get MQTT_ENABLE)
MQTT_HOST=$(get MQTT_HOST)
MQTT_PORT=$(get MQTT_PORT); [ -n "$MQTT_PORT" ] || MQTT_PORT=1883
MQTT_USER=$(get MQTT_USER)
MQTT_PASS=$(get MQTT_PASS)
MQTT_TOPIC=$(get MQTT_TOPIC); [ -n "$MQTT_TOPIC" ] || MQTT_TOPIC="atomcam/$NODE/event"

mqtt_auth() { [ -n "$MQTT_USER" ] && printf -- '-u %s:%s' "$MQTT_USER" "$MQTT_PASS"; }

# $1=channel(webhook|mqtt) $2=event $3=rc
record() {
  printf '{"channel":"%s","event":"%s","ok":%s,"at":"%s"}\n' \
    "$1" "$2" "$([ "$3" -eq 0 ] && echo true || echo false)" "$(date +'%Y/%m/%d %H:%M:%S')" > "$STATUS"
}

# $1=topic $2=payload $3=extra(例: -r で retain)
mqtt_pub() {
  [ "$MQTT_ENABLE" = "on" ] && [ -n "$MQTT_HOST" ] || return 1
  # shellcheck disable=SC2046
  curl -sf -m 3 $(mqtt_auth) $3 -d "$2" "mqtt://$MQTT_HOST:$MQTT_PORT/$1" >/dev/null 2>&1
}

send() {
  event="$1"; data="$2"
  if [ -n "$data" ]; then
    payload="{\"type\":\"$event\",\"device\":\"$HOSTNAME\",\"data\":$data}"
  else
    payload="{\"type\":\"$event\",\"device\":\"$HOSTNAME\"}"
  fi
  overall=0
  if [ -n "$WEBHOOK_URL" ]; then
    curl -sf -m 3 -X POST -H 'Content-Type: application/json' -d "$payload" $INSECURE "$WEBHOOK_URL" >/dev/null 2>&1
    rc=$?; record webhook "$event" "$rc"; [ "$rc" -eq 0 ] || overall=1
  fi
  if [ "$MQTT_ENABLE" = "on" ] && [ -n "$MQTT_HOST" ]; then
    mqtt_pub "$MQTT_TOPIC" "$payload"; rc=$?; record mqtt "$event" "$rc"; [ "$rc" -eq 0 ] || overall=1
  fi
  return $overall
}

discovery() {
  [ "$MQTT_ENABLE" = "on" ] && [ -n "$MQTT_HOST" ] || return 0
  dev="\"device\":{\"identifiers\":[\"atomcam_$NODE\"],\"name\":\"$HOSTNAME\",\"model\":\"ATOMCam\",\"manufacturer\":\"atomcam_tools\"}"
  cfg="{\"name\":\"$HOSTNAME Event\",\"state_topic\":\"$MQTT_TOPIC\",\"value_template\":\"{{ value_json.type }}\",\"unique_id\":\"atomcam_${NODE}_event\",$dev}"
  mqtt_pub "homeassistant/sensor/atomcam_$NODE/event/config" "$cfg" "-r"
}

case "$1" in
  --test)
    send testEvent >/dev/null 2>&1
    [ -f "$STATUS" ] && cat "$STATUS" || printf '{"channel":"none","event":"testEvent","ok":false,"at":""}\n'
    ;;
  --discovery) discovery ;;
  *) send "$1" "$2" ;;
esac
