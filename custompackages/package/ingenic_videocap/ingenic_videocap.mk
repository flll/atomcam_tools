INGENIC_VIDEOCAP_VERSION = f56caf60df55b16f9825e214183b567cd34aaaee
INGENIC_VIDEOCAP_SITE = https://github.com/openmiko/ingenic_videocap.git
INGENIC_VIDEOCAP_SITE_METHOD = git
INGENIC_VIDEOCAP_DEPENDENCIES =

# openmiko/ingenic_videocap declares cmake_minimum_required(VERSION 2.8) at
# the top of its CMakeLists.txt; CMake 4.x (shipped by Buildroot 2026.02 host
# tools) hard-rejects anything below 3.5 and aborts configure with
# "Compatibility with CMake < 3.5 has been removed from CMake.". Telling
# cmake to use 3.5-era policy semantics keeps the legacy file working
# without forking the upstream repository.
INGENIC_VIDEOCAP_CONF_OPTS = -DCMAKE_POLICY_VERSION_MINIMUM=3.5

$(eval $(cmake-package))
