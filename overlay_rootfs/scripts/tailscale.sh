#!/bin/bash
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
mkdir -p "$(dirname "$TAILSCALE_SOCKET")"

TAILSCALE_STATE_FILE="$TAILSCALE_STATE_DIR/tailscaled.state"
TAILSCALE_STATE_BAK="/media/mmc/tailscaled.state"
TAILSCALE_FAKEBIN="/tmp/fakebin"

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
    if [[ ! "$key" =~ ^tskey-(auth|client)-[a-zA-Z0-9-]{20,}$ ]]; then
        return 1
    fi
    return 0
}

validate_hostname() {
    local hostname="$1"
    if [[ ! "$hostname" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$ ]]; then
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
    
    if pgrep -f tailscaled > /dev/null; then
        echo "Tailscale daemon is already running"
        return 0
    fi
    
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
    if /usr/bin/tailscale up $up_args; then
        echo "Successfully connected to Tailscale"
        if [ "$TAILSCALE_EXITNODE_ONLY" = "on" ] || [ "$TAILSCALE_EXITNODE_ONLY" = "1" ]; then
            apply_port_guard
        else
            clear_port_guard
        fi
        ts_env
        /usr/bin/tailscale status
        persist_state
        return 0
    else
        echo "Error: Failed to connect to Tailscale"
        return 1
    fi
}

stop() {
    echo "Stopping Tailscale..."
    
    clear_port_guard
    /usr/bin/tailscale down 2>/dev/null || true
    
    if [ -f "$TAILSCALE_PID" ]; then
        local pid=$(cat "$TAILSCALE_PID")
        if kill "$pid" 2>/dev/null; then
            echo "Tailscale daemon stopped"
        fi
        rm -f "$TAILSCALE_PID"
    fi
    
    pkill -f tailscaled 2>/dev/null || true
}

status() {
    if pgrep -f tailscaled > /dev/null; then
        echo "Tailscale daemon is running"
        /usr/bin/tailscale status
    else
        echo "Tailscale daemon is not running"
    fi
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
    
    if ! connect; then
        stop
        exit 1
    fi
}

case "${1:-start}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 2
        start
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
