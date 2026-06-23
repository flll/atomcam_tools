#!/bin/bash
# #region agent log
agent_debug_log() {
  local hypothesis=$1 location=$2 message=$3 data=${4:-{}} run_id=${5:-pre-fix}
  local log=${ATOMCAM_AGENT_DEBUG_LOG:-$(cd $(dirname $0)/../.. && pwd)/sim-results/debug-6ef2a6.log}
  mkdir -p $(dirname $log)
  local ts
  ts=$(date +%s)000
  printf '''{sessionId:6ef2a6,runId:%s,hypothesisId:%s,location:%s,message:%s,data:%s,timestamp:%s}\n''' \
    $run_id $hypothesis $location $message $data $ts >> $log
}
# #endregion
