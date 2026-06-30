#include "libcb_trace.h"

static void __attribute__((constructor)) tier_stub_init(void) {
  libcb_trace("tier_stub");
}
