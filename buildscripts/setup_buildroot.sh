#!/bin/bash
set -e

# Build environment migration notes:
#   * Buildroot bumped from 2016.02 to 2026.02 LTS. The old version is
#     Python-2 only and does not build on modern hosts.
#   * Buildroot 2026.02's *internal* toolchain only supports gcc 13/14/15.
#     The camera firmware needs a gcc 4.9..7.x / glibc 2.21..2.27 / Linux 3.10
#     headers ABI to stay binary-compatible with the Ingenic T31 kernel and
#     vendor SDK blobs. We therefore switch to BR2_TOOLCHAIN_EXTERNAL pointing
#     at the Bootlin pre-built mips32el glibc toolchain stable-2017.05
#     (gcc 5.4.0 / glibc 2.24 / Linux 3.10.105 / binutils 2.27).
#   * The legacy crosstool-ng-built mipsel-ingenic-linux-uclibc toolchain at
#     /atomtools/build/cross/mips-uclibc/ is still produced for libcallback.so,
#     which is linked against uClibc-NG to interoperate with the proprietary
#     Ingenic blobs.

BUILDROOT_VERSION=${BUILDROOT_VERSION:-2026.02.1}
BUILDROOT_DIR=/atomtools/build/buildroot-${BUILDROOT_VERSION}

cd "${BUILDROOT_DIR}"

# Custom packages are now wired in via Buildroot's br2-external mechanism
# (custompackages/{external.desc,external.mk,Config.in}) instead of being
# copy-pasted on top of Buildroot's package/ tree. This means we no longer
# need to maintain a fork of Buildroot's main package/Config.in (which used
# to be 55 KB of stock 2016.02 references). All make invocations below pass
# BR2_EXTERNAL=/src/custompackages.
export BR2_EXTERNAL=/src/custompackages

# Re-base of the legacy patch set:
#   * add_fp_no_fused_madd.patch is dropped; Buildroot's toolchain-wrapper now
#     injects -ffp-contract=off automatically when BR2_mips_xburst=y (set in
#     atomcam_toolchain_external.fragment).
#   * linux_makefile.patch still wires the initramfs pre-build hook into
#     linux/linux.mk (LINUX_PRE_BUILD_HOOKS API is unchanged).
patch -p1 < /src/patches/linux_makefile.patch

cp /src/configs/atomcam_defconfig configs/
make atomcam_defconfig

# Apply the toolchain-external override fragment on top of the legacy defconfig
# (Buildroot 2026.02 dropped gcc 4.9 from the internal toolchain). olddefconfig
# then resolves remaining options to their new defaults / drops symbols that no
# longer exist. The resulting canonical defconfig is committed back so the
# next image build is reproducible.
cat /src/configs/atomcam_toolchain_external.fragment >> .config
make olddefconfig
make savedefconfig BR2_DEFCONFIG=/src/configs/atomcam_defconfig

# crosstool-ng is still required to produce the mipsel-ingenic-linux-uclibc
# toolchain that libcallback.so links against (Ingenic vendor blobs are uClibc
# based). Building it as an unprivileged user matches upstream guidance.
CROSS_TOOLS=crosstool-ng-1.26.0
useradd -m cross || true
mkdir -p /atomtools/build/cross/mips-uclibc
mkdir -p /atomtools/build/cross/src
mkdir -p /atomtools/build/cross/src/work
chown -R cross:cross /atomtools/build/cross

cd /atomtools/build/cross/src
curl http://crosstool-ng.org/download/crosstool-ng/${CROSS_TOOLS}.tar.xz | tar Jxf -
cd ${CROSS_TOOLS}
./configure --prefix=/atomtools/build/cross/tools
make
make install

cd /atomtools/build/cross/src/work
cp /src/configs/crosstools_config .config
chown cross:cross .config

# Pre-seed crosstool-ng's tarball cache. crosstool-ng 1.26.0 ships only a
# single mirror for uClibc-ng (downloads.uclibc-ng.org), and that host has
# been completely unreachable from CI as of 2026-05 (60s connect timeout).
# Bootlin keeps a verbatim copy of the same tarball under their toolchains
# source mirror, so we curl it (with retries) into CT_LOCAL_TARBALLS_DIR
# before invoking ct-ng. ct-ng then finds it locally and skips the network
# fetch entirely. The path here must match CT_LOCAL_TARBALLS_DIR in
# configs/crosstools_config.
TARBALL_DIR=/atomtools/build/cross/tarballs
mkdir -p "${TARBALL_DIR}"
chown -R cross:cross "${TARBALL_DIR}"
UCLIBC_NG_VER=1.0.43
UCLIBC_NG_FILE=uClibc-ng-${UCLIBC_NG_VER}.tar.xz
for url in \
    "https://toolchains.bootlin.com/downloads/releases/sources/uclibc-${UCLIBC_NG_VER}/${UCLIBC_NG_FILE}" \
    "https://downloads.uclibc-ng.org/releases/${UCLIBC_NG_VER}/${UCLIBC_NG_FILE}" \
    "http://downloads.uclibc-ng.org/releases/${UCLIBC_NG_VER}/${UCLIBC_NG_FILE}" \
    ; do
    if curl -fL --retry 5 --retry-delay 5 --retry-connrefused \
        --connect-timeout 30 --max-time 600 \
        -o "${TARBALL_DIR}/${UCLIBC_NG_FILE}" "${url}" ; then
        echo "uClibc-ng tarball cached from ${url}"
        break
    fi
    echo "WARN: failed to fetch ${url}, trying next mirror..." >&2
    rm -f "${TARBALL_DIR}/${UCLIBC_NG_FILE}"
done
[ -s "${TARBALL_DIR}/${UCLIBC_NG_FILE}" ] || {
    echo "FATAL: could not pre-fetch ${UCLIBC_NG_FILE} from any mirror" >&2
    exit 1
}
chown -R cross:cross "${TARBALL_DIR}"

# Build the toolchain with gcc-13 as the host compiler instead of Ubuntu 26.04's
# default gcc-15. crosstool-ng 1.26.0 pins GMP to 6.2.1, and GMP 6.2.1's
# "long long reliability test" in its configure script fails on gcc 15
# (fixed upstream in GMP 6.3.0, but ct-ng 1.26.0 doesn't know about 6.3.0).
# Bumping ct-ng would force a Kconfig rewrite of crosstools_config; using an
# older host compiler is the surgical workaround. gcc-13 is the newest host
# compiler that builds the entire ct-ng companion-libs stack cleanly.
#
# ct-ng explicitly aborts if $CC is set ("Don't set CC. It screws up the
# build."), so we cannot pass CC=gcc-13 via the environment. Instead we put
# a PATH-shim at the front of PATH that makes `gcc` resolve to gcc-13 only
# for this invocation.
GCC_SHIM_DIR=/atomtools/build/cross/gcc13-shim
mkdir -p "${GCC_SHIM_DIR}"
for tool in gcc g++ cpp gcc-ar gcc-nm gcc-ranlib gcov ; do
    ln -sf "/usr/bin/${tool}-13" "${GCC_SHIM_DIR}/${tool}"
done
chown -R cross:cross "${GCC_SHIM_DIR}"

sudo -u cross env \
    HOME=/home/cross \
    PATH="${GCC_SHIM_DIR}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    /atomtools/build/cross/tools/bin/ct-ng build

cd /atomtools/build/cross/mips-uclibc/mipsel-ingenic-linux-uclibc/sysroot
patch -p1 < /src/patches/linux_uclibc_hevc.patch

# Host Node.js (latest LTS at 2026-05) for the WebUI bundle build.
NODEVER=v24.15.0
NODEARCH=`uname -m`
[ "$NODEARCH" = "aarch64" ] && NODEARCH="arm64"
[ "$NODEARCH" = "x86_64" ] && NODEARCH="x64"
locale-gen --no-purge en_US.UTF-8
export LANG="en_US.UTF-8"
export LANGUAGE="en_US:en"
export LC_ALL="en_US.UTF-8"
cd /usr/local
curl https://nodejs.org/dist/${NODEVER}/node-${NODEVER}-linux-${NODEARCH}.tar.xz | tar Jxf -
ln -sfn /usr/local/node-${NODEVER}-linux-${NODEARCH} /usr/local/node

# Host Go (latest stable at 2026-05). Tailscale tracks Go closely; bump in
# lockstep with custompackages/package/tailscale/tailscale.mk if needed.
GO_VER=1.26.2
GO_ARCH=`uname -m`
[ "$GO_ARCH" = "aarch64" ] && GO_ARCH="arm64"
[ "$GO_ARCH" = "x86_64" ] && GO_ARCH="amd64"
cd /usr/local
curl https://dl.google.com/go/go${GO_VER}.linux-${GO_ARCH}.tar.gz | tar zxf -
ln -sfn /usr/local/go/bin/go /usr/local/bin/go

cd "${BUILDROOT_DIR}"
make clean && make
