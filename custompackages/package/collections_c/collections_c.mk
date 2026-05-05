COLLECTIONS_C_VERSION = fdcea75cc24112a7cb162bec845141ba3991aea3
COLLECTIONS_C_SITE = https://github.com/srdja/Collections-C.git
COLLECTIONS_C_SITE_METHOD = git
COLLECTIONS_C_DEPENDENCIES =

# CMake 4.x in Ubuntu 26.04 / Buildroot 2026.02 dropped backwards
# compatibility with cmake_minimum_required(VERSION < 3.5). Pin policy
# semantics to 3.5 to keep this legacy fork building. See
# ingenic_videocap.mk for the same workaround.
COLLECTIONS_C_CONF_OPTS = -DCMAKE_POLICY_VERSION_MINIMUM=3.5

$(eval $(cmake-package))
