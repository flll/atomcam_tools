#!/bin/sh

echo "Cache-Control: no-cache"
echo "Content-Type: text/plain"
echo ""

if [ "$REQUEST_METHOD" = "GET" ]; then
  # name= 以外のパラメータ(キャッシュバスター t= 等)が付いても name だけを取り出す。
  # 旧実装 ${QUERY_STRING##name=} は "name=status&t=123" で NAME="status&t=123" になり
  # 全ケース不一致 → 空応答になっていた。
  NAME=""
  _OLDIFS=$IFS; IFS='&'
  for _kv in $QUERY_STRING; do
    case "$_kv" in
      name=*) NAME=${_kv#name=} ;;
    esac
  done
  IFS=$_OLDIFS
  if [ "$NAME" = "" -o "$NAME" = "latest-ver" ] ; then
    latest=`curl -w "%{redirect_url}" -s -o /dev/null https://github.com/flll/atomcam_tools/releases/latest`
    echo LATESTVER=${latest##*Ver.}
  fi
  if [ "$NAME" = "" -o "$NAME" = "status" ] ; then
    echo TIMELAPSE=`echo "timelapse" | nc localhost:4000`
  fi
  if [ "$NAME" = "" -o "$NAME" = "status" ] ; then
    echo TIMESTAMP=`date +"%Y/%m/%d %X"`
  fi
  if [ "$NAME" = "" -o "$NAME" = "status" ] ; then
    res=`echo center | nc localhost:4000`
    echo CENTER=$res
  fi
  if [ "$NAME" = "" -o "$NAME" = "status" ] ; then
    res=`echo video flip | nc localhost:4000`
    echo FLIP=$res
  fi
  if [ "$NAME" = "" -o "$NAME" = "status" -o "$NAME" = "media-size" ] ; then
    df -k /media/mmc | awk '/\/media\/mmc/ { printf("MEDIASIZE=%d %d\n", $4, $2); }'
  fi
  if [ "$NAME" = "" -o "$NAME" = "status" ] ; then
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
  fi
  if [ "$NAME" = "storage-info" ] ; then
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
  fi
  if [ "$NAME" = "storage-du" ] ; then
    for d in record alarm_record time_lapse ; do
      [ -d "/media/mmc/$d" ] && echo "DU_$d=`du -sk /media/mmc/$d | cut -f1`"
    done
    true
  fi
fi

if [ "$REQUEST_METHOD" = "POST" ]; then
  PORT=${QUERY_STRING##port=}
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
