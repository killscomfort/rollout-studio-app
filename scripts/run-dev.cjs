#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const useCloud = process.env.ROLLOUT_USE_CLOUD === "1";
const script = useCloud ? "dev:cloud" : "dev:local";
console.log(
  useCloud
    ? "Using Supabase cloud backend (ROLLOUT_USE_CLOUD=1)."
    : "Using local SQLite backend. Set ROLLOUT_USE_CLOUD=1 or run npm run dev:cloud for Supabase."
);

const result = spawnSync("npm", ["run", script], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
