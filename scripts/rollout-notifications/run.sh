#!/bin/bash
# Sync rollout tasks to iCloud Calendar + fire Pushcut nudges. Called by launchd.
cd "$(dirname "$0")/../.." || exit 1

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

npm run sync:notifications >> rollout-notifications.log 2>&1
