FROM ubuntu:26.04

ENV DEBIAN_FRONTEND=noninteractive

# Host tools required by Buildroot 2026.02 LTS and the custom packages in this
# tree. Notes versus the previous ubuntu:16.04 environment:
#   * python (Python 2) and python-lzma are gone; Buildroot dropped Python 2
#     support years ago. python-is-python3 keeps `/usr/bin/python` available
#     for any third-party scripts that still hard-code it.
#   * libncurses5-dev was replaced by libncurses-dev (ncurses 6).
#   * qemu-user-static was split: qemu-user provides the static binaries and
#     qemu-user-binfmt handles binfmt registration.
#   * rsync and file are mandatory for Buildroot >= 2017.x.
#   * gcc-13 (next to the default gcc-15) is needed by the crosstool-ng host
#     compiler PATH-shim in setup_buildroot.sh; gcc-15 miscompiles GMP 6.2.1
#     ("long long reliability test 1" failure).
#   * libcrypt-dev / libssl-dev / libelf-dev: glibc on 16.04 bundled these in
#     libc6-dev. Ubuntu 26.04 split libxcrypt out (libcrypt-dev), and modern
#     Buildroot host packages (host-mkpasswd needs -lcrypt; host-uboot-tools
#     needs libssl; kernel module tooling needs libelf) link against them
#     explicitly. Without these the build dies silently mid-host-package phase.
RUN \
  apt-get update && apt-get upgrade -y && \
  apt-get install -y --no-install-recommends \
  build-essential \
  gcc-13 \
  g++-13 \
  qemu-user \
  qemu-user-binfmt \
  git \
  ca-certificates \
  autoconf \
  cmake \
  python3 \
  python3-dev \
  python3-distutils-extra \
  python-is-python3 \
  zip \
  unzip \
  cpio \
  wget \
  vim \
  locales \
  lzop \
  bc \
  nano \
  libncurses-dev \
  nfs-kernel-server \
  curl \
  flex \
  texinfo \
  help2man \
  gawk \
  libtool-bin \
  sudo \
  upx-ucl \
  bison \
  liblzma-dev \
  zlib1g-dev \
  libcrypt-dev \
  libssl-dev \
  libelf-dev \
  patchelf \
  rsync \
  file \
  pkg-config \
  xz-utils \
 && rm -rf /var/lib/apt/lists/*

# Modern unsquashfs (4.6.1) that can read OpenWrt 24.10 squashfs images.
# Buildroot's bundled host-squashfs is too old for those metadata blocks
# ("Data queue size is too large"). Required by the tailscale package to
# extract the musl runtime from a stock OpenWrt mipsel_24kc rootfs.
RUN curl -fsSL -o /tmp/sqfs.tar.gz \
      https://github.com/plougher/squashfs-tools/archive/refs/tags/4.6.1.tar.gz \
 && tar -xzf /tmp/sqfs.tar.gz -C /tmp \
 && cd /tmp/squashfs-tools-4.6.1/squashfs-tools \
 && make GZIP_SUPPORT=1 XZ_SUPPORT=1 ZSTD_SUPPORT=0 LZ4_SUPPORT=0 \
         -j$(nproc) unsquashfs \
 && install -m 0755 unsquashfs /usr/local/bin/unsquashfs-4.6.1 \
 && rm -rf /tmp/sqfs.tar.gz /tmp/squashfs-tools-4.6.1

ENV PATH="$PATH:/usr/local/node/bin:/usr/local/go/bin"

# GNU make 4.4 (Ubuntu 26.04 default) has a regression that re-evaluates
# $(shell ...) inside the Linux 3.10 kbuild when it processes the atbm_wifi
# OOT module's Makefile. It ends up calling /bin/sh in an infinite loop
# (verified via strace: ~3000 pipe2/clone/execve syscalls per second, no
# forward progress). Concretely the per-module sub-make
#   make -f scripts/Makefile.build obj=.../atbm_wifi-.../.
# never returns. Reproduced locally on the host: with /usr/bin/make 4.4 the
# same recipe never completes, with GNU make 4.3 it finishes in 0.1s.
# Setting MAKEFLAGS=--jobserver-style=pipe does NOT help (the bug is in
# variable expansion, not the jobserver). The surgical fix is to ship GNU
# make 4.3 in this image and divert /usr/bin/make to it; Buildroot, Linux
# kbuild and the OOT module makefiles all reach it via the absolute path.
RUN curl -fsSL https://ftp.gnu.org/gnu/make/make-4.3.tar.gz -o /tmp/make-4.3.tar.gz \
 && tar -xzf /tmp/make-4.3.tar.gz -C /tmp \
 && cd /tmp/make-4.3 \
 && ./configure --prefix=/usr/local --program-suffix= --without-guile \
 && ./build.sh \
 && cp -f make /usr/local/bin/make-4.3 \
 && /usr/local/bin/make-4.3 --version | head -1 \
 && rm -rf /tmp/make-4.3 /tmp/make-4.3.tar.gz \
 && dpkg-divert --local --rename --add /usr/bin/make \
 && ln -sf /usr/local/bin/make-4.3 /usr/bin/make \
 && /usr/bin/make --version | head -1

RUN mkdir -p /atomtools/build
WORKDIR "/atomtools/build"

# Buildroot 2026.02 LTS (matches Ubuntu 26.04 LTS release timing). The old
# 2016.02 is Python-2 only and does not build on modern hosts; see
# patches/ and custompackages/ for the corresponding migration notes.
ARG BUILDROOT_VERSION=2026.02.1
ENV BUILDROOT_VERSION=${BUILDROOT_VERSION}
RUN wget -qO - https://buildroot.org/downloads/buildroot-${BUILDROOT_VERSION}.tar.gz | tar zxf -

WORKDIR "/atomtools/build/buildroot-${BUILDROOT_VERSION}"

COPY . /src

RUN /src/buildscripts/setup_buildroot.sh
