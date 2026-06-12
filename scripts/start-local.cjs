const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const electronApp = path.join(
  projectRoot,
  "node_modules",
  "electron",
  "dist",
  "Electron.app",
  "Contents",
  "MacOS",
  "Electron"
);

function resolveNodeRunner() {
  if (fs.existsSync(electronApp)) {
    return {
      command: electronApp,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    };
  }

  return { command: "node", env: process.env };
}

function runBuild() {
  const runner = resolveNodeRunner();
  const vite = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
  const tsc = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");

  const client = spawnSync(
    runner.command,
    [vite, "build", "--config", "client/vite.config.ts"],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...runner.env, VITE_API_BASE: "http://127.0.0.1:3847" },
    }
  );
  if (client.status !== 0) {
    process.exit(client.status ?? 1);
  }

  const server = spawnSync(runner.command, [tsc, "-p", "server/tsconfig.json"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: runner.env,
  });
  if (server.status !== 0) {
    process.exit(server.status ?? 1);
  }

  spawnSync("cp", ["server/dist-package.json", "server/dist/package.json"], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  spawnSync(runner.command, ["scripts/setup-cloud.cjs", "write"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: runner.env,
  });
}

if (!fs.existsSync(path.join(projectRoot, "client/dist/index.html"))) {
  runBuild();
}

const launch = spawnSync(electronApp, ["."], {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

process.exit(launch.status ?? 0);
