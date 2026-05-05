################################################################################
#
# v4l2loopback-legacy
#
# Pinned to umlaeute/v4l2loopback git commit a6d82287, the last revision
# that still builds against Linux 3.10 (the Wyze Cam V3 / ATOMCam GPL kernel).
# Mainline v4l2loopback 0.15.3 (shipped by Buildroot 2026.02) refuses to
# compile with `#error This module is not supported on kernels before 4.0.0.`,
# hence this in-tree fork.
#
################################################################################

V4L2LOOPBACK_LEGACY_VERSION = a6d82287eb734588a11c33e7281671c80c9bf6d7
V4L2LOOPBACK_LEGACY_SITE = https://github.com/umlaeute/v4l2loopback.git
V4L2LOOPBACK_LEGACY_SITE_METHOD = git
V4L2LOOPBACK_LEGACY_LICENSE = GPL-2.0+
V4L2LOOPBACK_LEGACY_LICENSE_FILES = COPYING

# See ATBM_WIFI_MODULE_MAKE_OPTS in package/atbm_wifi/atbm_wifi.mk: GNU make 4.x
# jobservers + Linux 3.10 Kbuild occasionally deadlock/hang instead of
# launching gcc when invoked under Buildroot's top-level parallel make.
V4L2LOOPBACK_LEGACY_MODULE_MAKE_OPTS += -j1

ifeq ($(BR2_PACKAGE_V4L2LOOPBACK_LEGACY_UTILS),y)
define V4L2LOOPBACK_LEGACY_INSTALL_TARGET_CMDS
	$(INSTALL) -D -m 0755 $(@D)/utils/v4l2loopback-ctl $(TARGET_DIR)/usr/bin/v4l2loopback-ctl
endef
endif

$(eval $(kernel-module))

# overlay_rootfs/etc/init.d/S61atomcam expects the .ko at
# /lib/modules/v4l2loopback.ko (no kernel-version subdir, no depmod), so we
# bypass kernel-module's standard `make modules_install` and just drop the
# .ko file directly. This matches the legacy ATOMCam layout exactly.
define V4L2LOOPBACK_LEGACY_KERNEL_MODULES_INSTALL
	cp $(@D)/*.ko $(TARGET_DIR)/lib/modules
endef

$(eval $(generic-package))
