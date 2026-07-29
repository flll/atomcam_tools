#!/bin/sh

echo "Cache-Control: no-cache"
echo "Content-Type: text/plain"
echo ""

# QUERY_STRING から key=value の値を1つ取り出す(& 分解)。
# 旧実装 ${QUERY_STRING##key=} は "name=status&t=123" で値に "&t=123" が残り
# 全ケース不一致 → 空応答になっていた(GET は 2026-07-05 修正済み。POST 側の
# 同型バグ PORT=${QUERY_STRING##port=} も本関数への置換で解消)。
query_param() {
  _qp_out=""
  _OLDIFS=$IFS; IFS='&'
  for _kv in $QUERY_STRING; do
    case "$_kv" in
      "$1"=*) _qp_out=${_kv#"$1"=} ;;
    esac
  done
  IFS=$_OLDIFS
  printf '%s' "$_qp_out"
}

out_latest_ver() {
  latest=`curl -w "%{redirect_url}" -s -o /dev/null https://github.com/flll/atomcam_tools/releases/latest`
  echo LATESTVER=${latest##*Ver.}
}

out_media_size() {
  df -k /media/mmc | awk '/\/media\/mmc/ { printf("MEDIASIZE=%d %d\n", $4, $2); }'
}

out_motor_pos() {
  if [ -f /tmp/motor_initialize_done ] ; then
    res=`echo move | nc localhost:4000`
    [ "$res" = "error" ] || echo MOTORPOS=$res
  else
    awk '
      BEGIN {
        FS = "=";
        x = 0;
        y = 0;
      }
      /slide_x/ {
        x = $2 / 100;
      }
      /slide_y/ {
        y = $2 / 100;
      }
      /horSwitch/ {
        h = $2;
      }
      /verSwitch/ {
        v = $2;
      }
      END {
        if(h == 1) x = 355 - x;
        if(v == 1) y = 180 - y;
        printf("MOTORPOS=%f %f %d %d 0\n", x, y, h, v);
      }
    ' /atom/configs/.user_config
  fi
}

out_status() {
  echo TIMELAPSE=`echo "timelapse" | nc localhost:4000`
  echo TIMESTAMP=`date +"%Y/%m/%d %X"`
  res=`echo center | nc localhost:4000`
  echo CENTER=$res
  res=`echo video flip | nc localhost:4000`
  echo FLIP=$res
  out_media_size
  out_motor_pos
}

out_storage_info() {
  MNT=`grep ' /media/mmc ' /proc/mounts | head -n 1`
  if [ -n "$MNT" ] ; then
    echo "MOUNTED=1"
    echo "MOUNTDEV=`echo $MNT | cut -d' ' -f1`"
    echo "MOUNTFS=`echo $MNT | cut -d' ' -f3`"
    echo "MOUNTOPT=`echo $MNT | cut -d' ' -f4`"
    df -k /media/mmc | awk '/\/media\/mmc/ { printf("DF=%d %d %d\n", $2, $3, $4); }'
  else
    echo "MOUNTED=0"
  fi
  tail -n +2 /proc/swaps | awk '{ i++; printf("SWAP%d=%s %s %s\n", i, $1, $3, $4); }'
  awk '/^MemTotal:|^MemFree:|^MemAvailable:|^Cached:/ { k=toupper($1); gsub(":", "", k); printf("%s=%s\n", k, $2); }' /proc/meminfo
}

out_storage_du() {
  for d in record alarm_record time_lapse ; do
    [ -d "/media/mmc/$d" ] && echo "DU_$d=`du -sk /media/mmc/$d | cut -f1`"
  done
  true
}

if [ "$REQUEST_METHOD" = "GET" ]; then
  NAME=`query_param name`
  case "$NAME" in
    "")
      out_latest_ver
      out_status
      ;;
    latest-ver)
      out_latest_ver
      ;;
    status)
      out_status
      ;;
    media-size)
      out_media_size
      ;;
    storage-info)
      out_storage_info
      ;;
    storage-du)
      out_storage_du
      ;;
    notify-test)
      # イベント通知のテスト送信。結果 JSON(channel/ok/at)をそのまま返す
      /scripts/notify.sh --test
      ;;
    notify-status)
      # 直近の送信結果(無ければ空 JSON)
      [ -f /tmp/webhook_status ] && cat /tmp/webhook_status || echo '{}'
      ;;
    tailscale-status)
      # Tailscale 接続状態(state/ip/dnsName)を JSON で返す
      /scripts/tailscale.sh status-json 2>/dev/null || echo '{"state":"stopped"}'
      ;;
    tailscale-trial)
      # 適用トライアル(デッドマンスイッチ)の状態
      /scripts/tailscale.sh trial-status 2>/dev/null || echo '{"active":false,"remaining":0,"reverted":false}'
      ;;
  esac
fi

if [ "$REQUEST_METHOD" = "POST" ]; then
  PORT=`query_param port`
  awk '
    BEGIN {
      RS="[{},]";
    }
    /^$/ { next; }
    /\"exec\"\s*:\s*\"/ {
      gsub(/^\s*\"exec\"\s*:\s*\"/, "");
      gsub(/\"\s*$/, "");
      print $0;
      fflush();
    }
  ' | (
    if [ "$PORT" = "socket" ]; then
      /usr/bin/nc localhost:4000
    else
      cat >> /var/run/webcmd
      read ack < /var/run/webres
      echo $ack
    fi
  )
fi
