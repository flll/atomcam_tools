#!/bin/bash
# Buildroot post-image hook (runs inside docker). Stage build outputs to /src/target.
# zip 化はしない(host 側の sd-package.sh が hack.ini/WiFi 込みの1本を作る正本)。
set -e

cd output/images
echo "atomcam" > hostname
if [ -f /src/target/authorized_keys ]; then
	cp /src/target/authorized_keys authorized_keys
else
	touch authorized_keys
fi
cp -dpf uImage.lzma factory_t31_ZMC6tiIDQN
mv rootfs.squashfs rootfs_hack.squashfs

# build 成果物を target へステージ(zip は作らない)
cp -f factory_t31_ZMC6tiIDQN rootfs_hack.squashfs hostname authorized_keys /src/target
echo "post_image: staged 4 build files to /src/target (zip は sd-package が作成)"
