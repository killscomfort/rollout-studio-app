#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/node/bin:/Users/toejam808/Desktop/KillsAi/discomfort-co/.node/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
npm run sync:icloud -- --project=fuckdahaters >> rollout.log 2>&1
