#!/bin/bash
# Sync rollout tasks to iCloud Calendar + fire Pushcut nudges. Called by launchd.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

NODE=""
for candidate in \
  "$(command -v node 2>/dev/null)" \
  "/opt/homebrew/bin/node" \
  "/usr/local/bin/node" \
  "$HOME/Desktop/KillsAi/discomfort-co/.node/bin/node" \
  "$HOME/.nvm/versions/node/"*/bin/node; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    NODE="$candidate"
    break
  fi
done

if [ -z "$NODE" ]; then
  echo "node not found for rollout notifications" >&2
  exit 127
fi

"$NODE" scripts/rollout-notifications/run-cli.cjs >> rollout-notifications.log 2>&1
