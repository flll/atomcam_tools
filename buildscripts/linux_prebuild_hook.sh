#!/bin/bash

# Create the cpio root filesystem that is embedded in the kernel.
# This is a minimal root filesystem to bootstrap the bigger rootfs.
# BASE_DIR is exported by Buildroot when invoking pre-build hooks
# (it points at <buildroot>/output), so we no longer hard-code the
# Buildroot version directory.
/src/buildscripts/make_initramfs.sh "${BASE_DIR}"
