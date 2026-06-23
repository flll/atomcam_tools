################################################################################
#
# tailscale-prebuilt
# Prebuilt mipsle binaries from Tailscale releases.
# https://dl.tailscale.com/stable/tailscale_1.92.3_mipsle.tgz
#
# Stock Buildroot 2026.02 ships a source-build tailscale package; AtomCam uses
# the official prebuilt tarball for MIPS32r1/Ingenic T31 instead.
#
# NOTE: pinned to 1.92.3 (Go 1.25.5). tailscale >= 1.96 is built with Go 1.26,
# which has a runtime regression (futex_time64 / uname parse) that crashes on
# old 32-bit mipsle kernels like 3.10.14__isvp_swan_1.0__ before heap init.
# Refs: golang/go#77730, golang/go#77930, tailscale#19039. Do NOT bump past
# 1.94 until a Go >=1.26.2 (fix backport) tailscale mipsle build is available.
################################################################################

TAILSCALE_PREBUILT_VERSION = 1.92.3
TAILSCALE_PREBUILT_SOURCE = tailscale_$(TAILSCALE_PREBUILT_VERSION)_mipsle.tgz
TAILSCALE_PREBUILT_SITE = https://dl.tailscale.com/stable
TAILSCALE_PREBUILT_LICENSE = BSD-3-Clause
TAILSCALE_PREBUILT_LICENSE_FILES = LICENSE

define TAILSCALE_PREBUILT_EXTRACT_CMDS
	wget -O $(DL_DIR)/$(TAILSCALE_PREBUILT_SOURCE) $(TAILSCALE_PREBUILT_SITE)/$(TAILSCALE_PREBUILT_SOURCE)
	tar -xzf $(DL_DIR)/$(TAILSCALE_PREBUILT_SOURCE) -C $(@D) --strip-components=1
endef

define TAILSCALE_PREBUILT_INSTALL_TARGET_CMDS
	$(INSTALL) -D -m 0755 $(@D)/tailscale $(TARGET_DIR)/usr/bin/tailscale
	$(INSTALL) -D -m 0755 $(@D)/tailscaled $(TARGET_DIR)/usr/sbin/tailscaled
	$(INSTALL) -D -m 0644 $(@D)/systemd/tailscaled.service \
		$(TARGET_DIR)/etc/systemd/system/tailscaled.service
endef

define TAILSCALE_PREBUILT_INSTALL_INIT_SYSV
	$(INSTALL) -D -m 0755 $(TAILSCALE_PREBUILT_PKGDIR)/S60tailscale \
		$(TARGET_DIR)/etc/init.d/S80tailscale
endef

$(eval $(generic-package))
