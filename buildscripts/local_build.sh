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

# build webpage
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
