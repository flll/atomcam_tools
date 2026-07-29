#!/bin/sh
#
# Tailscale management script for ATOMCam
# This script manages Tailscale daemon and connection
#
TAILSCALE_HACK_INI="/tmp/hack.ini"
TAILSCALE_STATE_DIR="/tmp/tailscale"
TAILSCALE_SOCKET="/var/run/tailscale/tailscaled.sock"
TAILSCALE_PID="/var/run/tailscaled.pid"
TAILSCALE_EXITNODE_ONLY="off"

mkdir -p "$TAILSCALE_STATE_DIR"
mkdir -p "$(dirname "$TAILSCALE_SOCKET")"

TAILSCALE_STATE_FILE="$TAILSCALE_STATE_DIR/tailscaled.state"
TAILSCALE_STATE_BAK="/media/mmc/tailscaled.state"
TAILSCALE_FAKEBIN="/tmp/fakebin"
# WebUI 向け: 直近の up 失敗理由と、最後に成功した up 引数(ロールバック用)
TAILSCALE_LAST_ERROR="$TAILSCALE_STATE_DIR/last_error"
TAILSCALE_LAST_GOOD="$TAILSCALE_STATE_DIR/last_good_args"

# S60tailscale は umask 077 で呼ぶため、mkdir したソケットディレクトリが 700 になり
# lighttpd(www-data)の CGI から tailscale CLI が届かず WebUI の状態が常に「不明」になる。
# state ディレクトリは秘密(ノード鍵)を含むので 700 のまま、ソケット側だけ辿れるようにする。
fix_socket_perms() {
    chmod 755 "$(dirname "$TAILSCALE_SOCKET")" 2>/dev/null || true
}
fix_socket_perms

setup_fakebin() {
    mkdir -p "$TAILSCALE_FAKEBIN"
    cat > "$TAILSCALE_FAKEBIN/uname" <<'EOF'
#!/bin/sh
case "$1" in
  -r) echo "3.10.14"; exit 0 ;;
  -a) echo "Linux atomcam 3.10.14 mips"; exit 0 ;;
esac
exec busybox uname "$@"
EOF
    chmod +x "$TAILSCALE_FAKEBIN/uname"
}

ts_env() {
    PATH="$TAILSCALE_FAKEBIN:$PATH"
}

restore_state() {
    if [ -f "$TAILSCALE_STATE_BAK" ]; then
        if [ ! -f "$TAILSCALE_STATE_FILE" ] || [ ! -s "$TAILSCALE_STATE_FILE" ] ||            [ "$(wc -c <"$TAILSCALE_STATE_FILE" 2>/dev/null || echo 0)" -lt 64 ]; then
            cp "$TAILSCALE_STATE_BAK" "$TAILSCALE_STATE_FILE"
        fi
    fi
}

persist_state() {
    if [ -f "$TAILSCALE_STATE_FILE" ] &&        [ "$(wc -c <"$TAILSCALE_STATE_FILE" 2>/dev/null || echo 0)" -ge 64 ]; then
        cp "$TAILSCALE_STATE_FILE" "$TAILSCALE_STATE_BAK" 2>/dev/null
        sync
    fi
}


normalize_kernel_release() {
    if [ -w /proc/sys/kernel/osrelease ] 2>/dev/null; then
        echo 3.10.14 > /proc/sys/kernel/osrelease 2>/dev/null || true
    fi
}

check_binary_health() {
    setup_fakebin
    ts_env
    local version_out version_rc
    version_out="$(/usr/bin/tailscale version 2>&1 | head -1 | tr -d '\r')"
    version_rc=$?
    if [ "$version_rc" -ne 0 ]; then
        echo "Error: tailscale binary health check failed (rc=${version_rc})"
        echo "$version_out"
        return 1
    fi
    return 0
}

validate_auth_key() {
    local key="$1"
    # busybox ash に [[ =~ ]] は無い(bash-compat でも構文エラー)→ grep -E で検査
    if ! printf %s "$key" | grep -qE "^tskey-(auth|client)-[a-zA-Z0-9-]{20,}$"; then
        return 1
    fi
    return 0
}

validate_hostname() {
    local hostname="$1"
    if ! printf %s "$hostname" | grep -qE "^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$"; then
        return 1
    fi
    return 0
}

read_config_value() {
    local key="$1"
    local file="$2"
    [ -f "$file" ] || return 1
    awk -v key="$key" '
        index($0, "=") > 0 {
            k = $0
            sub(/=.*/, "", k)
            gsub(/^[ \t]+|[ \t]+$/, "", k)
            if (k == key) {
                v = $0
                sub(/^[^=]*=/, "", v)
                gsub(/^[ \t]+|[ \t]+$/, "", v)
                print v
                exit
            }
        }
    ' "$file" | tr -d '\r'
}

apply_port_guard() {
    command -v iptables >/dev/null 2>&1 || return 0
    for port in 80 8080 8554; do
        iptables -C INPUT -i tailscale0 -p tcp --dport "$port" -j ACCEPT >/dev/null 2>&1 || \
            iptables -I INPUT 1 -i tailscale0 -p tcp --dport "$port" -j ACCEPT
        iptables -C INPUT -i wlan0 -p tcp --dport "$port" -j DROP >/dev/null 2>&1 || \
            iptables -I INPUT 1 -i wlan0 -p tcp --dport "$port" -j DROP
    done
}

clear_port_guard() {
    command -v iptables >/dev/null 2>&1 || return 0
    for port in 80 8080 8554; do
        while iptables -C INPUT -i wlan0 -p tcp --dport "$port" -j DROP >/dev/null 2>&1; do
            iptables -D INPUT -i wlan0 -p tcp --dport "$port" -j DROP
        done
        while iptables -C INPUT -i tailscale0 -p tcp --dport "$port" -j ACCEPT >/dev/null 2>&1; do
            iptables -D INPUT -i tailscale0 -p tcp --dport "$port" -j ACCEPT
        done
    done
}

load_config() {
    local from_hackini=0
    local enabled_key

    if [ -f "$TAILSCALE_HACK_INI" ]; then
        from_hackini=1
        enabled_key="$(read_config_value "TAILSCALE_ENABLE" "$TAILSCALE_HACK_INI")"
        TAILSCALE_AUTH_KEY="$(read_config_value "TAILSCALE_AUTH_KEY" "$TAILSCALE_HACK_INI")"
        TAILSCALE_HOSTNAME="$(read_config_value "TAILSCALE_HOSTNAME" "$TAILSCALE_HACK_INI")"
        TAILSCALE_TAGS="$(read_config_value "TAILSCALE_TAGS" "$TAILSCALE_HACK_INI")"
        TAILSCALE_EXTRA_ARGS="$(read_config_value "TAILSCALE_EXTRA_ARGS" "$TAILSCALE_HACK_INI")"
        TAILSCALE_EXITNODE_ONLY="$(read_config_value "TAILSCALE_EXITNODE_ONLY" "$TAILSCALE_HACK_INI")"

        [ "$enabled_key" = "on" ] && TAILSCALE_ENABLE=1
        [ "$enabled_key" = "off" ] && TAILSCALE_ENABLE=0
    fi

    if [ -z "$TAILSCALE_ENABLE" ]; then
        if [ "$from_hackini" -eq 1 ]; then
            TAILSCALE_ENABLE=0
        else
            echo "Tailscale config file not found: $TAILSCALE_HACK_INI"
            return 1
        fi
    fi

    if [ "$TAILSCALE_ENABLE" != "1" ]; then
        echo "Tailscale is disabled in configuration"
        return 2
    fi
    
    if [ -z "$TAILSCALE_AUTH_KEY" ]; then
        echo "Error: TAILSCALE_AUTH_KEY is not set"
        return 1
    fi
    
    if [ -n "$TAILSCALE_HOSTNAME" ]; then
        echo "Using configured TAILSCALE_HOSTNAME for Tailscale: $TAILSCALE_HOSTNAME"
    else
        if [ -f "/media/mmc/hostname" ]; then
            TAILSCALE_HOSTNAME=$(cat /media/mmc/hostname | tr -d '\n\r')
            echo "Using system hostname from file for Tailscale: $TAILSCALE_HOSTNAME"
        else
            TAILSCALE_HOSTNAME=$(hostname)
            echo "Using system hostname command for Tailscale: $TAILSCALE_HOSTNAME"
        fi
    fi
    
    if ! validate_hostname "$TAILSCALE_HOSTNAME"; then
        echo "Error: Invalid hostname format: $TAILSCALE_HOSTNAME"
        return 1
    fi
    
    if ! validate_auth_key "$TAILSCALE_AUTH_KEY"; then
        echo "Error: Invalid TAILSCALE_AUTH_KEY format"
        return 1
    fi

    if [ -z "$TAILSCALE_TAGS" ]; then
        TAILSCALE_TAGS="tag:cctv"
    fi
    
    return 0
}

start_daemon() {
    echo "Starting Tailscale daemon..."

    if ! check_binary_health; then
        return 1
    fi

    if pidof tailscaled > /dev/null; then
        echo "Tailscale daemon is already running"
        return 0
    fi

    # /media/mmc のバックアップからノード識別を復元してから起動する。
    # これが無いと毎 boot 空 state で up し直し、tailnet に atomcam33-N が増殖する
    # (F-9 設計の復元側。persist_state は connect 成功時に呼ばれるが、
    #  restore_state は定義だけで未配線だった)
    restore_state

    /usr/sbin/tailscaled \
        --state="$TAILSCALE_STATE_DIR/tailscaled.state" \
        --socket="$TAILSCALE_SOCKET" \
        --port=41641 \
        --tun=userspace-networking &
    
    local daemon_pid=$!
    echo $daemon_pid > "$TAILSCALE_PID"
    
    local timeout=10
    while [ $timeout -gt 0 ]; do
        if /usr/bin/tailscale status >/dev/null 2>&1; then
            echo "Tailscale daemon started successfully"
            return 0
        fi
        sleep 1
        timeout=$((timeout - 1))
    done
    
    echo "Error: Tailscale daemon failed to start"
    return 1
}

# up の失敗理由を WebUI が読める1行テキストで残す(JSON には status_json 側で整形)
record_up_error() {
    printf '%s' "$1" | tr '\r\n' '  ' | cut -c1-500 > "$TAILSCALE_LAST_ERROR"
}

apply_guard_and_persist() {
    if [ "$TAILSCALE_EXITNODE_ONLY" = "on" ] || [ "$TAILSCALE_EXITNODE_ONLY" = "1" ]; then
        apply_port_guard
    else
        clear_port_guard
    fi
    ts_env
    /usr/bin/tailscale status
    persist_state
}

connect() {
    echo "Connecting to Tailscale network..."

    local up_args="--auth-key=$TAILSCALE_AUTH_KEY --hostname=$TAILSCALE_HOSTNAME --ssh --timeout=60s"

    if [ -n "$TAILSCALE_TAGS" ]; then
        up_args="$up_args --advertise-tags=$TAILSCALE_TAGS"
        echo "Using Tailscale tags: $TAILSCALE_TAGS"
    fi

    if [ -n "$TAILSCALE_EXTRA_ARGS" ]; then
        up_args="$up_args $TAILSCALE_EXTRA_ARGS"
    fi

    ts_env
    local up_out
    # 認証待ち等で up が --timeout を素通りして永久に固まるケースを実機で観測。
    # ハード上限を掛け、超えたら失敗として扱う(daemon は残る)
    if up_out=$(timeout 90 /usr/bin/tailscale up $up_args 2>&1); then
        echo "Successfully connected to Tailscale"
        rm -f "$TAILSCALE_LAST_ERROR"
        printf '%s\n' "$up_args" > "$TAILSCALE_LAST_GOOD"
        apply_guard_and_persist
        return 0
    fi

    echo "Error: Failed to connect to Tailscale"
    echo "$up_out"
    record_up_error "$up_out"

    # タグ変更ミス(ACL 未許可等)で up が失敗しても、直前まで動いていた接続まで
    # 失うと tailscale 経由のアクセスが締め出される。最後に成功した引数で
    # ロールバックを試み、少なくとも旧設定での到達性を維持する。
    if [ -s "$TAILSCALE_LAST_GOOD" ]; then
        local good_args
        good_args=$(cat "$TAILSCALE_LAST_GOOD")
        if [ "$good_args" != "$up_args" ]; then
            echo "Attempting rollback to last known-good settings..."
            ts_env
            if timeout 90 /usr/bin/tailscale up $good_args 2>/dev/null; then
                echo "Rollback succeeded (still using previous settings)"
                apply_guard_and_persist
                return 1
            fi
            echo "Rollback also failed"
        fi
    fi
    return 1
}

stop() {
    echo "Stopping Tailscale..."

    clear_port_guard
    timeout 10 /usr/bin/tailscale down 2>/dev/null || true

    if [ -f "$TAILSCALE_PID" ]; then
        local pid=$(cat "$TAILSCALE_PID")
        if kill "$pid" 2>/dev/null; then
            echo "Tailscale daemon stopped"
        fi
        rm -f "$TAILSCALE_PID"
    fi

    pkill -f tailscaled 2>/dev/null || true

    # kill は非同期。死にかけプロセスを次の start_daemon が「起動済み」と
    # 誤認して二重管理になる競合を実機で観測 → 消えるまで待つ(最後は SIGKILL)
    local i=0
    while pidof tailscaled > /dev/null 2>&1 && [ "$i" -lt 15 ]; do
        sleep 1
        i=$((i + 1))
    done
    pidof tailscaled > /dev/null 2>&1 && pkill -9 tailscaled 2>/dev/null
    return 0
}

status() {
    if pidof tailscaled > /dev/null; then
        echo "Tailscale daemon is running"
        /usr/bin/tailscale status
    else
        echo "Tailscale daemon is not running"
    fi
}

# ===== 適用トライアル(デッドマンスイッチ) =====
# 締め出しリスクのある設定適用の前に UI が trial-start を送る。適用後、UI 上の
# 「接続は維持されていますか?」に対する trial-confirm が期限内に届かなければ、
# hack.ini 全体をスナップショットへ巻き戻して再接続する(PS の解像度変更と同じ発想。
# 締め出された瞬間からブラウザは何も送れないため、巻き戻しは必ずデバイス側で自律実行する)。
# state ディレクトリ(700・ノード鍵入り)とは分離し、www-data の CGI からも
# 状態を読めるよう 755 の専用ディレクトリに置く。スナップショットに auth key を
# 含むが、hack.ini 自体が無認証の hack_ini.cgi で読める前提のデバイスであり
# 脅威モデルは既存と同等
TRIAL_DIR="/tmp/tailscale-trial"
mkdir -p "$TRIAL_DIR"
chmod 755 "$TRIAL_DIR" 2>/dev/null || true
TRIAL_BAK="$TRIAL_DIR/trial_hack.ini.bak"
TRIAL_CONFIRM="$TRIAL_DIR/trial.confirm"
TRIAL_PID="$TRIAL_DIR/trial.pid"
TRIAL_REVERTED="$TRIAL_DIR/trial.reverted"
TRIAL_DEADLINE="$TRIAL_DIR/trial.deadline"

trial_revert_now() {
    [ -f "$TRIAL_BAK" ] || return 1
    echo "trial: reverting hack.ini to pre-change snapshot"
    cat "$TRIAL_BAK" > /media/mmc/hack.ini
    cat "$TRIAL_BAK" > /tmp/hack.ini
    sync
    rm -f "$TRIAL_BAK" "$TRIAL_DEADLINE"
    date +%s > "$TRIAL_REVERTED"
    chmod 644 "$TRIAL_REVERTED" 2>/dev/null || true
    # 巻き戻した設定で再接続(自分自身の restart を呼ぶ)
    "$0" restart
}

trial_start() {
    secs="${1:-120}"
    case "$secs" in *[!0-9]*|"") secs=120 ;; esac
    # 進行中の旧トライアルは破棄(watchdog を止めてから上書き)
    [ -f "$TRIAL_PID" ] && kill "$(cat "$TRIAL_PID")" 2>/dev/null
    rm -f "$TRIAL_CONFIRM" "$TRIAL_REVERTED" "$TRIAL_PID"
    cp /tmp/hack.ini "$TRIAL_BAK" || { echo "trial: snapshot failed"; return 1; }
    expr "$(date +%s)" + "$secs" > "$TRIAL_DEADLINE"
    # webcmd(root・umask 077)経由でも CGI(www-data)から読めるように
    chmod 644 "$TRIAL_BAK" "$TRIAL_DEADLINE" 2>/dev/null || true
    (
        sleep "$secs"
        if [ ! -f "$TRIAL_CONFIRM" ] && [ -f "$TRIAL_BAK" ]; then
            trial_revert_now >> /tmp/tailscale_trial.log 2>&1
        fi
        rm -f "$TRIAL_PID"
    ) &
    echo $! > "$TRIAL_PID"
    echo "trial: armed (${secs}s)"
}

trial_confirm() {
    touch "$TRIAL_CONFIRM"
    [ -f "$TRIAL_PID" ] && kill "$(cat "$TRIAL_PID")" 2>/dev/null
    rm -f "$TRIAL_BAK" "$TRIAL_PID" "$TRIAL_DEADLINE" "$TRIAL_REVERTED"
    echo "trial: confirmed"
}

# UI ポーリング用: {"active":bool,"remaining":n,"reverted":bool}
trial_status() {
    active=false; remaining=0; reverted=false
    if [ -f "$TRIAL_BAK" ] && [ -f "$TRIAL_DEADLINE" ]; then
        active=true
        now=$(date +%s)
        deadline=$(cat "$TRIAL_DEADLINE")
        remaining=$(expr "$deadline" - "$now" 2>/dev/null || echo 0)
        [ "$remaining" -ge 0 ] 2>/dev/null || remaining=0
    fi
    [ -f "$TRIAL_REVERTED" ] && reverted=true
    printf '{"active":%s,"remaining":%s,"reverted":%s}\n' "$active" "$remaining" "$reverted"
}

# WebUI 向け: 接続状態を JSON 1行で返す(state/ip/dnsName)。jq は無いので grep 抽出。
status_json() {
    ts_env
    if ! pidof tailscaled > /dev/null 2>&1; then
        lasterr=""
        if [ -s "$TAILSCALE_LAST_ERROR" ]; then
            lasterr=$(tr -d '"\\\r\n' < "$TAILSCALE_LAST_ERROR")
        fi
        printf '{"state":"stopped","lastError":"%s"}\n' "$lasterr"
        return 0
    fi
    # up の進行中は status/ip が無期限ブロックする(実機観測: WebUI の5秒ポーリングが
    # 積み上がり www-data プロセスが増殖)→ 必ずタイムアウトを掛ける
    json=$(timeout 5 /usr/bin/tailscale status --json 2>/dev/null)
    ip=$(timeout 3 /usr/bin/tailscale ip -4 2>/dev/null | head -1)
    # tailscale status --json はキーと値の間にスペースを入れる("BackendState": "Running")。
    # 旧パターン '"BackendState":"..."' はスペース無し前提で常に不一致となり、
    # WebUI の Tailscale ページは接続中でも state=unknown を表示していた。
    backend=$(printf '%s' "$json" | grep -o '"BackendState":[ ]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
    dnsname=$(printf '%s' "$json" | grep -o '"DNSName":[ ]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/;s/[.]$//')
    [ -n "$backend" ] || backend="unknown"
    # 直近の up 失敗理由(あれば)。JSON を壊す文字は落とす
    lasterr=""
    if [ -s "$TAILSCALE_LAST_ERROR" ]; then
        lasterr=$(tr -d '"\\\r\n' < "$TAILSCALE_LAST_ERROR")
    fi
    printf '{"state":"%s","ip":"%s","dnsName":"%s","lastError":"%s"}\n' "$backend" "$ip" "$dnsname" "$lasterr"
}

start() {
    if ! load_config; then
        local exit_code=$?
        if [ $exit_code -eq 2 ]; then
            exit 0
        else
            exit 1
        fi
    fi
    
    if ! start_daemon; then
        exit 1
    fi
    
    # connect 失敗時に stop まですると、直前まで生きていた tailscale 経由の
    # アクセスも道連れに落ちて締め出しになる。デーモンは残して状態を
    # WebUI(status-json の state/lastError)から診断できるようにする。
    if ! connect; then
        exit 1
    fi
}

# start/stop/restart の重なり(WebUI 適用とトライアル復元 watchdog 等)を直列化する。
# 保持者が消えても詰まらないよう 120 秒で奪取する
TAILSCALE_OP_LOCK="/tmp/tailscale-op.lock"
acquire_op_lock() {
    local n=0
    while ! mkdir "$TAILSCALE_OP_LOCK" 2>/dev/null; do
        n=$((n + 1))
        # 保持側の最長シーケンス(stop 25s + up 90s + ロールバック 90s + 余裕)より長く待つ
        if [ "$n" -ge 300 ]; then
            echo "op-lock: stale, stealing"
            rm -rf "$TAILSCALE_OP_LOCK"
        fi
        sleep 1
    done
    trap 'rmdir "$TAILSCALE_OP_LOCK" 2>/dev/null' EXIT
}

case "${1:-start}" in
    start)
        acquire_op_lock
        start
        ;;
    stop)
        acquire_op_lock
        stop
        ;;
    restart)
        acquire_op_lock
        stop
        sleep 2
        start
        ;;
    status)
        status
        ;;
    status-json)
        status_json
        ;;
    trial-start)
        trial_start "$2"
        ;;
    trial-confirm)
        trial_confirm
        ;;
    trial-revert)
        trial_revert_now
        ;;
    trial-status)
        trial_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|status-json}"
        exit 1
        ;;
esac
