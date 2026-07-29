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

# タイムアウト実測(2026-07-29 実機): この SoC は TLS ハンドシェイクだけで 4.3〜5.1 秒
# かかるため、旧 -m 3 では https の WebHook が構造的に全て rc=28(timeout)で失敗していた。
WEBHOOK_TIMEOUT=10
MQTT_TIMEOUT=5

# curl の exit code を人が読める短い理由に変換する
curl_reason() {
  case "$1" in
    0) echo "" ;;
    6) echo "DNS lookup failed" ;;
    7) echo "connection refused" ;;
    22) echo "HTTP error" ;;
    28) echo "timeout" ;;
    35|60) echo "TLS error" ;;
    *) echo "curl error $1" ;;
  esac
}

# $1=channel(webhook|mqtt) $2=event $3=rc $4=reason(空なら curl_reason から生成)
# チャネル別の一時ファイルに書き、finalize_status で1オブジェクトに集約する
# (旧実装は両チャネル有効時に > 上書きで最後のチャネルの結果しか残らなかった)
# at はデバイスのローカル表記、epoch は WebUI が閲覧者のタイムゾーンで整形するための UNIX 秒
record() {
  reason="$4"
  [ -n "$reason" ] || reason="$(curl_reason "$3")"
  reason=$(printf '%s' "$reason" | tr -d '"\\' | cut -c1-200)
  printf '{"channel":"%s","event":"%s","ok":%s,"at":"%s","epoch":%s,"reason":"%s"}\n' \
    "$1" "$2" "$([ "$3" -eq 0 ] && echo true || echo false)" "$(date +'%Y/%m/%d %H:%M:%S')" "$(date +%s)" "$reason" > "$STATUS.$1"
}

# WebUI(parseNotifyStatus)は単一 JSON オブジェクト前提のため、STATUS は1行を維持し
# 「失敗したチャネルを優先」で集約する(失敗が UI に埋もれないように)
finalize_status() {
  for f in "$STATUS.webhook" "$STATUS.mqtt"; do
    [ -f "$f" ] && grep -q '"ok":false' "$f" && { cat "$f" > "$STATUS"; return 0; }
  done
  for f in "$STATUS.mqtt" "$STATUS.webhook"; do
    [ -f "$f" ] && { cat "$f" > "$STATUS"; return 0; }
  done
  return 0
}

# $1=topic $2=payload $3=extra(例: -r で retain)
mqtt_pub() {
  [ "$MQTT_ENABLE" = "on" ] && [ -n "$MQTT_HOST" ] || return 1
  # shellcheck disable=SC2046
  curl -sf -m "$MQTT_TIMEOUT" $(mqtt_auth) $3 -d "$2" "mqtt://$MQTT_HOST:$MQTT_PORT/$1" >/dev/null 2>&1
}

send() {
  event="$1"; data="$2"
  if [ -n "$data" ]; then
    payload="{\"type\":\"$event\",\"device\":\"$HOSTNAME\",\"data\":$data}"
  else
    payload="{\"type\":\"$event\",\"device\":\"$HOSTNAME\"}"
  fi
  overall=0
  rm -f "$STATUS.webhook" "$STATUS.mqtt"
  if [ -n "$WEBHOOK_URL" ]; then
    # Discord/Slack の webhook は独自 JSON({"content":...}/{"text":...})しか受けないため
    # URL から判別して自動変換する(生 payload を送ると常に HTTP 400 で失敗していた)
    body="$payload"
    case "$WEBHOOK_URL" in
      *discord.com/api/webhooks/*|*discordapp.com/api/webhooks/*)
        detail=$(printf '%s' "$data" | tr -d '"\\' | tr '\n' ' ')
        body="{\"content\":\"[$HOSTNAME] $event${detail:+ }${detail}\"}" ;;
      *hooks.slack.com/*)
        body="{\"text\":\"[$HOSTNAME] $event\"}" ;;
    esac
    http_code=$(curl -s -o /dev/null -w '%{http_code}' -m "$WEBHOOK_TIMEOUT" -X POST -H 'Content-Type: application/json' -d "$body" $INSECURE "$WEBHOOK_URL" 2>/dev/null)
    rc=$?
    reason=""
    if [ "$rc" -eq 0 ]; then
      case "$http_code" in
        2*) rc=0 ;;
        *) rc=22; reason="HTTP $http_code" ;;
      esac
    fi
    record webhook "$event" "$rc" "$reason"; [ "$rc" -eq 0 ] || overall=1
  fi
  if [ "$MQTT_ENABLE" = "on" ] && [ -n "$MQTT_HOST" ]; then
    mqtt_pub "$MQTT_TOPIC" "$payload"; rc=$?; record mqtt "$event" "$rc"; [ "$rc" -eq 0 ] || overall=1
  fi
  finalize_status
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
