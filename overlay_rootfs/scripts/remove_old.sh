#!/bin/sh

HACK_INI=/tmp/hack.ini
PERIODICREC_SDCARD_REMOVE=$(awk -F "=" '/^PERIODICREC_SDCARD_REMOVE *=/ {print $2}' $HACK_INI)
PERIODICREC_SDCARD_REMOVE_DAYS=$(awk -F "=" '/^PERIODICREC_SDCARD_REMOVE_DAYS *=/ {print $2}' $HACK_INI)
ALARMREC_SDCARD_REMOVE=$(awk -F "=" '/^ALARMREC_SDCARD_REMOVE *=/ {print $2}' $HACK_INI)
ALARMREC_SDCARD_REMOVE_DAYS=$(awk -F "=" '/^ALARMREC_SDCARD_REMOVE_DAYS *=/ {print $2}' $HACK_INI)
TIMELAPSE_SDCARD_REMOVE=$(awk -F "=" '/^TIMELAPSE_SDCARD_REMOVE *=/ {print $2}' $HACK_INI)
TIMELAPSE_SDCARD_REMOVE_DAYS=$(awk -F "=" '/^TIMELAPSE_SDCARD_REMOVE_DAYS *=/ {print $2}' $HACK_INI)
PERIODICREC_CIFS_REMOVE=$(awk -F "=" '/^PERIODICREC_CIFS_REMOVE *=/ {print $2}' $HACK_INI)
PERIODICREC_CIFS_REMOVE_DAYS=$(awk -F "=" '/^PERIODICREC_CIFS_REMOVE_DAYS *=/ {print $2}' $HACK_INI)
ALARMREC_CIFS_REMOVE=$(awk -F "=" '/^ALARMREC_CIFS_REMOVE *=/ {print $2}' $HACK_INI)
ALARMREC_CIFS_REMOVE_DAYS=$(awk -F "=" '/^ALARMREC_CIFS_REMOVE_DAYS *=/ {print $2}' $HACK_INI)
TIMELAPSE_CIFS_REMOVE=$(awk -F "=" '/^TIMELAPSE_CIFS_REMOVE *=/ {print $2}' $HACK_INI)
TIMELAPSE_CIFS_REMOVE_DAYS=$(awk -F "=" '/^TIMELAPSE_CIFS_REMOVE_DAYS *=/ {print $2}' $HACK_INI)
ALARMREC_SDCARD=$(awk -F "=" '/^ALARMREC_SDCARD *=/ {print $2}' $HACK_INI)
PERIODICREC_SDCARD=$(awk -F "=" '/^PERIODICREC_SDCARD *=/ {print $2}' $HACK_INI)
HOSTNAME=`hostname`

if [ "$ALARMREC_SDCARD_REMOVE" = "on" ] && [ "$ALARMREC_SDCARD_REMOVE_DAYS" != "" ]; then
  find /media/mmc/alarm_record -depth -type f -mtime +$ALARMREC_SDCARD_REMOVE_DAYS -delete
  find /media/mmc/alarm_record -depth -type d -mmin +3 -empty -delete
fi
if [ "$PERIODICREC_SDCARD_REMOVE" = "on" ] && [ "$PERIODICREC_SDCARD_REMOVE_DAYS" != "" ]; then
  find /media/mmc/record -depth -type f -mtime +$PERIODICREC_SDCARD_REMOVE_DAYS -delete
  find /media/mmc/record -depth -type d -mmin +3 -empty -delete
fi
if [ "$TIMELAPSE_SDCARD_REMOVE" = "on" ] && [ "$TIMELAPSE_SDCARD_REMOVE_DAYS" != "" ]; then
  find /media/mmc/time_lapse -depth -type f -mtime +$TIMELAPSE_SDCARD_REMOVE_DAYS -delete
  find /media/mmc/time_lapse -depth -type d -mmin +3 -empty -delete
fi
find /media/mmc/time_lapse -depth -type f -name '*._mp4' -mtime +3 -delete
find /media/mmc/time_lapse -depth -type f -name '*.stsz' -mtime +3 -delete

[ "$PERIODICREC_CIFS_REMOVE" != "on" ] && [ "$ALARMREC_CIFS_REMOVE" != "on" ] && [ "$TIMELAPSE_CIFS_REMOVE" != "on" ] && exit 0

/atom_patch/system_bin/mount_cifs.sh || exit -1

if [ "$ALARMREC_CIFS_REMOVE" = "on" ] && [ "$ALARMREC_CIFS_REMOVE_DAYS" != "" ]; then
  find /atom/mnt/$HOSTNAME/alarm_record -depth -type f -mtime +$ALARMREC_CIFS_REMOVE_DAYS -delete
  find /atom/mnt/$HOSTNAME/alarm_record -depth -type d -mmin +3 -empty -delete
fi
if [ "$PERIODICREC_CIFS_REMOVE" = "on" ] && [ "$PERIODICREC_CIFS_REMOVE_DAYS" != "" ]; then
  find /atom/mnt/$HOSTNAME/record -depth -type f -mtime +$PERIODICREC_CIFS_REMOVE_DAYS -delete
  find /atom/mnt/$HOSTNAME/record -depth -type d -mmin +3 -empty -delete
fi
if [ "$TIMELAPSE_CIFS_REMOVE" = "on" ] && [ "$TIMELAPSE_CIFS_REMOVE_DAYS" != "" ]; then
  find /atom/mnt/$HOSTNAME/time_lapse -depth -type f -mtime +$TIMELAPSE_CIFS_REMOVE_DAYS -delete
  find /atom/mnt/$HOSTNAME/time_lapse -depth -type d -mmin +3 -empty -delete
fi

# 空き床ガード: 空きが 1GB を切ったら最古の録画日ディレクトリから削除し、
# SD フル起因の全機能不全(録画停止・ログ死・設定保存失敗)を防ぐ安全網。
# 保持日数設定(*_REMOVE)とは独立。今日の分は消さない。削除は atomhack.log に記録。
FREE_KB=$(df -k /media/mmc | awk 'NR==2 {print $4}')
if [ -n "$FREE_KB" ] && [ "$FREE_KB" -lt 1048576 ]; then
  TODAY=$(date +%Y%m%d)
  for base in /media/mmc/record /media/mmc/alarm_record; do
    for d in $(ls "$base" 2>/dev/null | sort); do
      FREE_KB=$(df -k /media/mmc | awk 'NR==2 {print $4}')
      [ "$FREE_KB" -ge 1572864 ] && break 2
      [ "$d" = "$TODAY" ] && continue
      echo "$(date +'%Y/%m/%d %H:%M:%S') : low-space guard: remove $base/$d (free ${FREE_KB}KB)" >> /media/mmc/atomhack.log
      rm -rf "${base:?}/${d:?}"
    done
  done
fi
