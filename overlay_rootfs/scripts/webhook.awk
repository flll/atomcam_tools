# webhook.awk — iCamera stdout(FIFO /var/run/atomapp)のイベント解析本体。
# 起動・respawn 管理は /scripts/webhook.sh(ラッパー)が行う。
# 通知は stdout に「event<TAB>data」で1行出力し、ラッパーの dispatcher が
# notify.sh へ argv で渡す(旧実装の system()+手書き \x27 エスケープを廃止)。
# ログ書式・1024B/s レートリミッタ・各イベントの発火条件は旧実装と同一。
BEGIN {
  FS = "=";
  while((getline < HACK_INI) == 1) {
    ENV[$1]=$2;
  }
  FS = " ";
  logDisable = 1;
  lastTimestamp = 0;
  logPause = 0;
  if(ATOM_LOG == "on") logDisable = 0;
}

/\[webhook\] time_lapse_event/ {
  if(TIMELAPSE_HOOK == "on") {
    split($4, count, "/");
    system("/media/mmc/timelapse_hook.sh " $3 " " count[1] " " count[2] " " $5 " >/dev/null 2>&1 &");
  }
}

/\[webhook\] time_lapse_finish/ {
  split($0, str, / \t*/);
  system("/scripts/timelapse.sh finish " str[3]);
}

/motor reset done./ {
  system("/scripts/motor_init reboot");
  if(!logDisable) print "motor reset done !!!" >> "/tmp/log/atom.log";
  print "motor reset done !!!" >> "/dev/console";
  print > "/tmp/motor_initialize_done";
}

{
  if(!logDisable) {
    timestamp = systime();
    logLength += length($0);
    if(timestamp != lastTimestamp) {
      if(logLength / (timestamp - lastTimestamp) < 1024) {
        logPause = 0;
      } else {
        logPause = 1;
        time = strftime("%Y/%m/%d %H:%M:%S", timestamp);
        printf("%s : --- Logging is suspended ---\n", time) >> "/tmp/log/atom.log";
      }
      logLength = 0;
      lastTimestamp = timestamp;
    }
    if(!logPause) print >> "/tmp/log/atom.log";
  }
  if(ENV["WEBHOOK_URL"] == "" && ENV["MQTT_ENABLE"] != "on") next;
}

/\[aiAlgo\] start/ {
  if(ENV["WEBHOOK_ALARM_EVENT"] == "on") Post("alarmEvent");
}

/alarm_event_handle.*timestamp/ {
  if(ENV["WEBHOOK_ALARM_EVENT"] == "on") Post("alarmEvent");
}

/(alarm_event_handle).*== readly to alarm ==/ {
  if(ENV["WEBHOOK_ALARM_EVENT"] == "on") Post("alarmEvent");
}

/\[aiAlgo\] call_TD_Human_Pet_Predict/ {
  gsub(/^.*Predict \[off:[0-9]*\] /, "");
  gsub(/tm:/, "");
  gsub(/\|/, ",");
  gsub(/res:/, ",");
  gsub(/\[/, "");
  gsub(/\]/, "");
  if(ENV["WEBHOOK_ALARM_INFO"] == "on") Post("recognitionNotify", "\"" $0 "\"");
}

/alarm_event_handle.*alarmType/ {
  gsub(/^.*alarmType:/, "");
  if(ENV["WEBHOOK_ALARM_INFO"] == "on") Post("recognitionNotify", "\"" $0 "\"");
}

/\[webhook\] time_lapse_event/ {
  gsub(/^.*time_lapse_event /, "");
  if(ENV["WEBHOOK_TIMELAPSE_EVENT"] == "on") Post("timelapseEvent", "\"" $0 "\"");
}

function Post(event, data) {
  # event<TAB>data を1行で dispatcher へ。fflush でイベントを即時送出する
  # (data 内に単引用符があっても壊れない — 旧 system() 方式は壊れていた)
  printf("%s\t%s\n", event, data);
  fflush();
}
