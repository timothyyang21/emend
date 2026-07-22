#!/usr/bin/env bash
# 60-sec backstop: screen-record the booted simulator.  record.sh start|stop [out.mov]
set -euo pipefail
cmd="${1:-start}"; out="${2:-demo.mov}"; pid="/tmp/cactus-record.pid"
case "$cmd" in
  start)
    xcrun simctl io booted recordVideo --codec h264 "$out" & echo $! > "$pid"
    echo "● recording booted sim → $out   (stop: scripts/record.sh stop)";;
  stop)
    [ -f "$pid" ] && kill -INT "$(cat "$pid")" 2>/dev/null || true; rm -f "$pid"
    echo "■ stopped → $out";;
  *) echo "usage: record.sh start|stop [out.mov]"; exit 1;;
esac
