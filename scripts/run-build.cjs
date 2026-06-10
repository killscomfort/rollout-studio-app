#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { cloud } = require("./backend-mode.cjs");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (cloud) {
  run("npm", ["run", "build:client"]);
  run("node", ["scripts/setup-cloud.cjs", "write"]);
} else {
  run("npm", ["run", "build:client:local"]);
  run("npm", ["run", "build:server"]);
  run("node", ["scripts/setup-cloud.cjs", "write"]);
}
