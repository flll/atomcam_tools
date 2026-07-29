#!/bin/sh

if [ "$1" = "off" ]; then
  killall lighttpd > /dev/null 2>&1
  echo `date +"%Y/%m/%d %H:%M:%S"` ": lighttpd stop"
  exit 0
fi

if [ "$1" = "watchdog" ]; then
  pidof lighttpd > /dev/null && exit 0
fi

HACK_INI=/tmp/hack.ini
DIGEST=$(awk -F "=" '/^DIGEST *=/ {print $2}' $HACK_INI | tr -d '\r')
if [ "$DIGEST" != "" ]; then
  echo $DIGEST > /etc/lighttpd/user.digest
  echo 'server.modules += ( "mod_auth" )' > /etc/lighttpd/auth.conf
else
  echo $DIGEST > /etc/lighttpd/user.digest
  echo '#server.modules += ( "mod_auth" )' > /etc/lighttpd/auth.conf
fi

# 401(サインイン失敗/キャンセル)時の案内ページを生成する。
# ブラウザの認証ダイアログをキャンセルするとこのページが表示される。
# 初心者向けに「ユーザー名は admin」「リセット手順」と機体の識別情報を載せる
gen_error_page() {
  ERRDIR=/tmp/lighttpd-err
  mkdir -p $ERRDIR
  MODEL=$(awk -F "=" '/^PRODUCT_MODEL/ {print $2}' /atom/configs/.product_config 2>/dev/null)
  MAC=$(ifconfig 2>/dev/null | awk '/HWaddr/ { gsub(/^.*HWaddr */, ""); print; exit }')
  HOST=$(hostname)
  cat > $ERRDIR/errfile-401.html <<HTML
<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>サインインが必要です - $HOST</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;
    background:#111;color:#fff;display:flex;min-height:100dvh;align-items:center;justify-content:center;padding:24px}
  .card{max-width:560px;background:#1f1f1f;border:1px solid #3f3f3f;border-radius:13px;padding:28px}
  h1{font-size:20px;margin:0 0 12px}
  p,li{font-size:14px;line-height:1.7;color:#b7b7b7}
  strong,code{color:#fff}
  code{background:#2a2a2a;padding:2px 6px;border-radius:4px;font-family:ui-monospace,Consolas,monospace}
  table{margin-top:16px;border-collapse:collapse;width:100%}
  td{font-size:13px;padding:6px 0;border-top:1px solid #3f3f3f;color:#b7b7b7}
  td:last-child{text-align:right;color:#fff;font-family:ui-monospace,Consolas,monospace}
  a{color:#40b6ff}
  ol{padding-left:20px}
  .en{margin-top:20px;border-top:1px solid #3f3f3f;padding-top:14px;font-size:12px;color:#949494}
</style></head><body><div class="card">
<h1>サインインが必要です</h1>
<p>ユーザー名は <strong>admin</strong> です。パスワードは WebUI ログイン設定で決めたものを入力してください。
<a href="/">再試行する</a></p>
<p><strong>パスワードを忘れた場合(リセット手順):</strong></p>
<ol>
<li>カメラの電源を切り、SDカードを取り出して PC に挿す</li>
<li>SDカード内の <code>hack.ini</code> を開き、<code>DIGEST=</code> で始まる行を削除して保存</li>
<li>SDカードを戻して電源を入れる(ログインなしで開けるようになるので、再設定してください)</li>
</ol>
<table>
<tr><td>モデル</td><td>$MODEL</td></tr>
<tr><td>ホスト名</td><td>$HOST</td></tr>
<tr><td>MACアドレス</td><td>$MAC</td></tr>
</table>
<p class="en">Sign-in required. The username is <strong>admin</strong>.
Forgot the password? Power off, remove the DIGEST= line from hack.ini on the SD card, and boot again.</p>
</div></body></html>
HTML
}
gen_error_page

if [ "$1" = "restart" ]; then
  killall lighttpd > /dev/null 2>&1
  while netstat -ltn 2> /dev/null | grep ':80 ' > /dev/null; do
    sleep 0.5
  done
fi

echo `date +"%Y/%m/%d %H:%M:%S"` ": lighttpd start"
mkdir -p /tmp/log/lighttpd
chown www-data:www-data /tmp/log/lighttpd
/usr/sbin/lighttpd -f /etc/lighttpd/lighttpd.conf
