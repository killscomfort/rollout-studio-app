#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { cloud } = require("./backend-mode.cjs");

const script = cloud ? "dev:cloud" : "dev:local";
console.log(cloud ? "Using Supabase cloud backend." : "Using local SQLite backend.");

const result = spawnSync("npm", ["run", script], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
