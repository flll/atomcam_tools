#!/bin/sh
# webui_auth.sh — WebUI(lighttpd)の digest 認証を設定/解除する。
#
#   webui_auth.sh set <user> <password>   認証を有効にする
#   webui_auth.sh clear                   認証を解除する
#
# hack.ini の DIGEST に htdigest 形式("user:realm:md5(user:realm:pass)")を書き、
# lighttpd を再起動する(lighttpd.sh が DIGEST の有無で mod_auth を出し分ける)。
# 認証が無いと hack_ini.cgi が auth key やパスワードを含む全設定を無認証で返すため、
# これが WebUI 全体の入口の鍵になる。
REALM="atomcam"
HACK_INI=/tmp/hack.ini
HACK_INI_SD=/media/mmc/hack.ini

# hack.ini の1キーを更新する(無ければ追記)。busybox awk で完結させる。
set_key() {
    key="$1"
    val="$2"
    for f in "$HACK_INI_SD" "$HACK_INI"; do
        [ -f "$f" ] || continue
        awk -v key="$key" -v val="$val" '
            BEGIN { done = 0 }
            index($0, "=") > 0 {
                k = $0
                sub(/=.*/, "", k)
                gsub(/^[ \t]+|[ \t]+$/, "", k)
                if (k == key) {
                    if (!done) { print key "=" val; done = 1 }
                    next
                }
            }
            { print }
            END { if (!done) print key "=" val }
        ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
    done
    sync
}

case "$1" in
    set)
        user="$2"
        pass="$3"
        if [ -z "$user" ] || [ -z "$pass" ]; then
            echo "usage: $0 set <user> <password>"
            exit 1
        fi
        # ユーザー名に ':' が入ると htdigest の区切りが壊れる
        case "$user" in
            *:*) echo "error: username must not contain ':'"; exit 1 ;;
        esac
        hash=$(printf '%s:%s:%s' "$user" "$REALM" "$pass" | md5sum | cut -d' ' -f1)
        [ -n "$hash" ] || { echo "error: md5sum failed"; exit 1; }
        set_key DIGEST "$user:$REALM:$hash"
        /scripts/lighttpd.sh restart
        echo "webui auth enabled for $user"
        ;;
    clear)
        set_key DIGEST ""
        /scripts/lighttpd.sh restart
        echo "webui auth disabled"
        ;;
    status)
        d=$(awk -F= '/^DIGEST *=/ {sub(/^[^=]*=/,""); print; exit}' "$HACK_INI")
        u=$(printf '%s' "$d" | cut -d: -f1)
        if [ -n "$d" ]; then
            printf '{"enabled":true,"user":"%s"}\n' "$u"
        else
            printf '{"enabled":false,"user":""}\n'
        fi
        ;;
    *)
        echo "usage: $0 {set <user> <password>|clear|status}"
        exit 1
        ;;
esac
