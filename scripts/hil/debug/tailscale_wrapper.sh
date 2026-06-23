#!/bin/sh
# DEPRECATED: fake uname does NOT help. Go runtime reads uname(2) syscall, not the
# `uname` command, so PATH tricks are ineffective. The real fix is pinning tailscale
# to a pre-Go-1.26 build (see custompackages/package/tailscale-prebuilt/*.mk = 1.92.3).
# Refs: golang/go#77730, tailscale#19039. This wrapper now just starts tailscale.
exec /scripts/tailscale.sh start
