#!/bin/bash
set -e

echo "Executing pre filesystem image creation script"

# The environment variables BR2_CONFIG, HOST_DIR, STAGING_DIR,
# TARGET_DIR, BUILD_DIR, BINARIES_DIR and BASE_DIR are defined

/src/buildscripts/local_build.sh

find $TARGET_DIR -name .DS_Store -delete
cp /src/configs/atomhack.ver $TARGET_DIR/etc

BUILDROOT_VERSION=${BUILDROOT_VERSION:-2026.02.1}
DEFAULT_BUILDROOT_OUT="/atomtools/build/buildroot-${BUILDROOT_VERSION}/output"
DEFAULT_IMAGE_DIR="${DEFAULT_BUILDROOT_OUT}/images"
BASE_DIR=${BASE_DIR:-${DEFAULT_BUILDROOT_OUT}}
IMAGES="${BASE_DIR}/images"
HOST_DIR=${HOST_DIR:-${DEFAULT_BUILDROOT_OUT}/host}
TARGET_DIR=${TARGET_DIR:-${DEFAULT_BUILDROOT_OUT}/target}
