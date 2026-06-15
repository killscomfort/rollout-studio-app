#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "../..");
const args = process.argv.slice(2);

function resolveNodeRunner() {
  const electronNode = path.join(
    root,
    "node_modules",
    "electron",
    "dist",
    "Electron.app",
    "Contents",
    "MacOS",
    "Electron"
  );

  if (fs.existsSync(electronNode)) {
    return {
      command: electronNode,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    };
  }

  return { command: "node", env: process.env };
}

const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const runner = resolveNodeRunner();
const result = spawnSync(
  runner.command,
  [tsx, path.join(__dirname, "main.ts"), ...args],
  { cwd: root, stdio: "inherit", env: runner.env }
);

process.exit(result.status ?? 1);
