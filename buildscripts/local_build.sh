#!/bin/sh

#remove init.d files
rm -f $TARGET_DIR/etc/init.d/S20urandom
rm -f $TARGET_DIR/etc/init.d/S40network
rm -f $TARGET_DIR/etc/init.d/S50sshd
rm -f $TARGET_DIR/etc/init.d/S50lighttpd

#add mount-point
mkdir -p $TARGET_DIR/media/mmc
mkdir -p $TARGET_DIR/boot
mkdir -p $TARGET_DIR/atom
mkdir -p $TARGET_DIR/configs

# build libcallback.so
export CROSS_BASE=/atomtools/build/cross/mips-uclibc
export CROSS_COMPILE=${CROSS_BASE}/bin/mipsel-ingenic-linux-uclibc-
export CFLAGS="-std=gnu99"
LOCAL_DIR="${BASE_DIR:?BASE_DIR is not set}/local"
rm -rf ${LOCAL_DIR}/libcallback
mkdir -p ${LOCAL_DIR}
cp -pr /src/libcallback ${LOCAL_DIR}
cd ${LOCAL_DIR}/libcallback
make
[ $? != 0 ] && exit 1
mkdir -p $TARGET_DIR/lib/modules/
cp -dpf libcallback.so $TARGET_DIR/lib/modules/libcallback.so

# build webpage (WEB_UI=web-new default, WEB_UI=web for legacy Vue2 backup)
WEB_UI="${WEB_UI:-web-new}"

build_web_legacy() {
  WEB_DIR="${BASE_DIR}/web"
  mkdir -p ${WEB_DIR}
  cp -pr /src/web/webpack.config.js /src/web/package* /src/web/source ${WEB_DIR}
  cd ${WEB_DIR}
  rm -rf frontend
  npm install -g npm@latest
  npm install
  ./node_modules/.bin/webpack --mode production --progress
  [ $? != 0 ] && exit 1
  rm -rf $TARGET_DIR/var/www/bundle*
  cp -pr frontend/* $TARGET_DIR/var/www
}

build_web_new() {
  WEB_DIR="${BASE_DIR}/web-new-build"
  rm -rf ${WEB_DIR}
  mkdir -p ${WEB_DIR}
  cp -pr /src/web-new/package.json /src/web-new/package-lock.json \
    /src/web-new/tsconfig.json /src/web-new/tsconfig.app.json \
    /src/web-new/tsconfig.node.json /src/web-new/vite.config.ts \
    /src/web-new/index.html /src/web-new/postcss.config.js \
    /src/web-new/tailwind.config.ts /src/web-new/components.json \
    /src/web-new/eslint.config.js ${WEB_DIR}/
  cp -pr /src/web-new/src /src/web-new/public /src/web-new/scripts ${WEB_DIR}/
  cd ${WEB_DIR}
  npm ci
  [ $? != 0 ] && exit 1
  npm run build
  [ $? != 0 ] && exit 1
  npm run budget
  [ $? != 0 ] && exit 1

  # Replace SPA assets; keep cgi-bin, sdcard, dirindex.css, webrtc.html from overlay template.
  rm -rf $TARGET_DIR/var/www/assets
  rm -f $TARGET_DIR/var/www/index.html $TARGET_DIR/var/www/index.html.gz $TARGET_DIR/var/www/index.html.br
  cp -pr dist/* $TARGET_DIR/var/www/

  # lighttpd serves .js/.css via rewrite to .gz — drop uncompressed copies when .gz exists.
  find $TARGET_DIR/var/www -type f \( -name '*.js' -o -name '*.css' \) ! -name '*.gz' ! -name '*.br' | while read -r f; do
    [ -f "${f}.gz" ] && rm -f "$f"
  done
}

if [ "$WEB_UI" = "web" ]; then
  build_web_legacy
else
  build_web_new
fi
