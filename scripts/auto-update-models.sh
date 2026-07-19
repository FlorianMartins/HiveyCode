#!/usr/bin/env bash
# 🐝 Daily model refresh for HiveyCode (run by hiveycode-models.timer).
#
# Rebuilds + restarts ONLY when the catalogue actually moved: update-models.mjs exits 10 when it
# rewrote src/agent/models.ts, 0 when everything was already on the newest model. A rebuild costs
# ~1 min of CPU and a few seconds of downtime, so we never pay it for nothing.
set -uo pipefail
cd /opt/hiveycode || exit 1

node scripts/update-models.mjs
rc=$?

case "$rc" in
  0)
    echo "No model change — nothing to rebuild."
    ;;
  10)
    echo "Model assignments changed → rebuilding HiveyCode…"
    # A broken build must NOT take the site down: only restart once `next build` succeeded.
    if npm run build; then
      systemctl restart hiveycode
      echo "✓ HiveyCode rebuilt and restarted on the new models."
    else
      echo "✗ Build FAILED — keeping the running version (models.ts was updated on disk)." >&2
      exit 1
    fi
    ;;
  *)
    echo "✗ Model update failed (exit $rc) — keeping the current models." >&2
    exit "$rc"
    ;;
esac
