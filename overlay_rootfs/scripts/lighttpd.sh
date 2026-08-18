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

# Tailscale専用通信: on なら loopback のみにバインドし、LAN からの 80 番を閉じる
# (tailnet 経由は tailscaled が loopback へ差し込むので届く)。
# /tmp/portguard.state は tailscale.sh との申し合わせ(不要な再起動の抑止)
EXITNODE_ONLY=$(awk -F "=" '/^TAILSCALE_EXITNODE_ONLY *=/ {print $2}' $HACK_INI | tr -d '\r')
if [ "$EXITNODE_ONLY" = "on" ]; then
  echo 'server.bind = "127.0.0.1"' > /tmp/lighttpd-bind.conf
  echo on > /tmp/portguard.state
else
  echo '# bind: all interfaces' > /tmp/lighttpd-bind.conf
  echo off > /tmp/portguard.state
fi

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
# ログイン前なので SPA の i18n は使えない。hack.ini の LOCALE を初期値にし、
# ページ内の 日本語/English で切り替えられるようにする。
gen_error_page() {
  ERRDIR=/tmp/lighttpd-err
  mkdir -p $ERRDIR
  MODEL=$(awk -F "=" '/^PRODUCT_MODEL/ {print $2}' /atom/configs/.product_config 2>/dev/null)
  MAC=$(ifconfig 2>/dev/null | awk '/HWaddr/ { gsub(/^.*HWaddr */, ""); print; exit }')
  HOST=$(hostname)
  LOCALE=$(awk -F "=" '/^LOCALE *=/ {print $2}' $HACK_INI | tr -d '\r')
  DEFAULT_LANG=ja
  [ "$LOCALE" = "en" ] && DEFAULT_LANG=en
  cat > $ERRDIR/errfile-401.html <<HTML
<!DOCTYPE html>
<html lang="$DEFAULT_LANG" data-default-lang="$DEFAULT_LANG"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign-in required - $HOST</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;
    background:#111;color:#fff;display:flex;min-height:100dvh;align-items:center;justify-content:center;padding:24px}
  .card{max-width:560px;background:#1f1f1f;border:1px solid #3f3f3f;border-radius:13px;padding:28px;position:relative}
  .lang{display:flex;gap:8px;justify-content:flex-end;margin:0 0 16px}
  .lang button{background:#2a2a2a;color:#b7b7b7;border:1px solid #3f3f3f;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer}
  .lang button[aria-pressed="true"]{color:#fff;border-color:#40b6ff;background:#16324a}
  h1{font-size:20px;margin:0 0 12px}
  p,li{font-size:14px;line-height:1.7;color:#b7b7b7}
  strong,code{color:#fff}
  code{background:#2a2a2a;padding:2px 6px;border-radius:4px;font-family:ui-monospace,Consolas,monospace}
  table{margin-top:16px;border-collapse:collapse;width:100%}
  td{font-size:13px;padding:6px 0;border-top:1px solid #3f3f3f;color:#b7b7b7}
  td:last-child{text-align:right;color:#fff;font-family:ui-monospace,Consolas,monospace}
  a{color:#40b6ff}
  ol{padding-left:20px}
</style></head><body><div class="card">
<div class="lang" role="group" aria-label="Language">
  <button type="button" data-lang-btn="ja">日本語</button>
  <button type="button" data-lang-btn="en">English</button>
</div>
<div data-lang="ja">
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
</div>
<div data-lang="en">
<h1>Sign-in required</h1>
<p>The username is <strong>admin</strong>. Use the password set in WebUI login settings.
<a href="/">Try again</a></p>
<p><strong>Forgot the password (reset):</strong></p>
<ol>
<li>Power off the camera, remove the SD card, and insert it into a PC</li>
<li>Open <code>hack.ini</code> on the SD card and delete the line that starts with <code>DIGEST=</code></li>
<li>Put the SD card back and power on (the UI opens without login; set a password again)</li>
</ol>
<table>
<tr><td>Model</td><td>$MODEL</td></tr>
<tr><td>Hostname</td><td>$HOST</td></tr>
<tr><td>MAC address</td><td>$MAC</td></tr>
</table>
</div>
<script>
(function () {
  var KEY = 'atomcam-auth-help-lang';
  var def = document.documentElement.getAttribute('data-default-lang') || 'ja';
  function apply(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang]').forEach(function (el) {
      el.hidden = el.getAttribute('data-lang') !== lang;
    });
    document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang-btn') === lang ? 'true' : 'false');
    });
    try { localStorage.setItem(KEY, lang); } catch (e) {}
  }
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  apply(saved === 'en' || saved === 'ja' ? saved : def);
  document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
    b.addEventListener('click', function () { apply(b.getAttribute('data-lang-btn')); });
  });
})();
</script>
</div></body></html>
HTML
}
if [ "$1" = "gen-error" ]; then
  gen_error_page
  exit 0
fi
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
