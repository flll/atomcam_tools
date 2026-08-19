include $(sort $(wildcard $(BR2_EXTERNAL_ATOMCAM_TOOLS_PATH)/package/*/*.mk))

# Linux 3.10 + glibc 2.24 には getrandom が無い。expat 2.8.2 はエントロピー源が
# 無いと xmlparse.c で #error する。/dev/urandom を使う。
EXPAT_CONF_ENV += CFLAGS="$(TARGET_CFLAGS) -DXML_DEV_URANDOM"
