#include "libcb_trace.h"
#include <stdio.h>

static void __attribute ((constructor)) setStdoutLineBuffer(void) {
  libcb_trace("setlinebuf");
  setvbuf(stdout, NULL, _IOLBF, 0);
}
