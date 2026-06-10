#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { cloud } = require("./backend-mode.cjs");

function run(args) {
  const result = spawnSync("npm", args, { stdio: "inherit", shell: true });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (cloud) {
  run(["run", "start:cloud"]);
} else {
  run(["run", "start:local"]);
}
