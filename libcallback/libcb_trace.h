#ifndef LIBCB_TRACE_H
#define LIBCB_TRACE_H
#include <stdio.h>
static inline void libcb_trace(const char *name) {
  FILE *f = fopen("/tmp/libcb-trace.log", "a");
  if (f) { fprintf(f, "%s\n", name); fclose(f); }
  f = fopen("/media/mmc/libcb-trace.log", "a");
  if (f) { fprintf(f, "%s\n", name); fclose(f); }
  fprintf(stderr, "libcb_trace:%s\n", name);
}
#endif
