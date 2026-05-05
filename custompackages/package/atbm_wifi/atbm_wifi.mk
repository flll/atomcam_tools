################################################################################
#
# atbm_wifi
#
################################################################################

ATBM_WIFI_VERSION = 5243746967626551d29dd17ebdc7c1e4659bfb17
ATBM_WIFI_SITE = https://github.com/OpenIPC/atbm_60xx.git
ATBM_WIFI_SITE_METHOD = git
ATBM_WIFI_LICENSE = GPLv2
ATBM_WIFI_LICENSE_FILES = COPYING

# Ubuntu 26.04 ships GNU make 4.4 with the POSIX fifo jobserver by default.
# Linux 3.10's Kbuild plus nested `make -f scripts/Makefile.build ... modules`
# can spin forever consuming CPU without spawning compilers when it inherits a
# parallel jobserver from the parent Buildroot make (-jN). Force single-job
# module builds for this legacy Wi-Fi driver (same workaround applies to every
# other kernel-module package targeting Wyze's 3.10 tree).
ATBM_WIFI_MODULE_MAKE_OPTS += -j1

$(eval $(kernel-module))

define ATBM_WIFI_KERNEL_MODULES_INSTALL
	cp $(@D)/hal_apollo/*.ko $(TARGET_DIR)/lib/modules
endef

$(eval $(generic-package))

