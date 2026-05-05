#!/bin/bash

set -o errexit          # Exit on most errors (see the manual)
set -o errtrace         # Make sure any error trap is inherited
set -o nounset          # Disallow expansion of unset variables
set -o pipefail         # Use last non-zero exit code in a pipeline

if [ $# -eq 0 ]
then
    echo "Usage: $0 <output_dir>"
    exit 1
fi

echo "=== build initramfs ==="

# In Buildroot 2016.02 the per-package staging dir lived at
# $(BASE_DIR)/staging as a regular directory. In Buildroot 2026.02 that
# location is only created as a symlink (-> $HOST_DIR/<TUPLE>/sysroot) by the
# `staging-finalize` target which runs *after* every package has been
# built/installed. Since this script is invoked from LINUX_PRE_BUILD_HOOKS,
# the symlink does not exist yet. We therefore use the $STAGING_DIR and
# $HOST_DIR variables that Buildroot exports into every package's build env
# (see package/Makefile.in: STAGING_DIR / HOST_DIR). They point at the real
# install locations regardless of per-package-directories mode.
#
# patches/linux_makefile.patch declares the matching LINUX_DEPENDENCIES so the
# `[ -f X ] || make Y` recursive-make safety nets below are now no-ops, but
# they are kept in case this script is ever invoked stand-alone outside the
# linux build (e.g. from buildscripts/build_all).
: "${STAGING_DIR:=$BASE_DIR/host/mipsel-buildroot-linux-gnu/sysroot}"
: "${HOST_DIR:=$BASE_DIR/host}"

[ -f "$STAGING_DIR/bin-init/fsck.fat"   ] || make dosfstools-init
[ -f "$STAGING_DIR/bin-init/fsck.exfat" ] || make exfatprogs-init
[ -f "$STAGING_DIR/bin-init/busybox"    ] || make busybox-init
[ -f "$HOST_DIR/bin/mkimage"            ] || make host-uboot-tools

ROOTFS_DIR=$1/initramfs_root
rm -rf $ROOTFS_DIR
mkdir -p $ROOTFS_DIR

cd $ROOTFS_DIR
mkdir -p {bin,dev,etc,lib,mnt,proc,root,sbin,sys,tmp}

cp -r /src/initramfs_skeleton/* $ROOTFS_DIR/
cp "$STAGING_DIR/bin-init/fsck.fat"   $ROOTFS_DIR/bin/
cp "$STAGING_DIR/bin-init/fsck.exfat" $ROOTFS_DIR/bin/
cp "$STAGING_DIR/bin-init/busybox"    $ROOTFS_DIR/bin/

# Save a few bytes by removing the readme
rm -f $ROOTFS_DIR/README.md

mknod $ROOTFS_DIR/dev/console c 5 1
mknod $ROOTFS_DIR/dev/null c 1 3
mknod $ROOTFS_DIR/dev/tty0 c 4 0
mknod $ROOTFS_DIR/dev/tty1 c 4 1
mknod $ROOTFS_DIR/dev/tty2 c 4 2
mknod $ROOTFS_DIR/dev/tty3 c 4 3
mknod $ROOTFS_DIR/dev/tty4 c 4 4

find . | cpio -H newc -o > ../images/initramfs.cpio
