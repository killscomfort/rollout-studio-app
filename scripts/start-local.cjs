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

function newestMtime(targetPath) {
  if (!fs.existsSync(targetPath)) return 0;
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return fs.readdirSync(targetPath, { withFileTypes: true }).reduce((latest, entry) => {
    return Math.max(latest, newestMtime(path.join(targetPath, entry.name)));
  }, 0);
}

function needsBuild() {
  if (process.env.ROLLOUT_FORCE_BUILD === "1") return true;
  const distIndex = path.join(projectRoot, "client/dist/index.html");
  if (!fs.existsSync(distIndex)) return true;
  const distTime = fs.statSync(distIndex).mtimeMs;
  const sourceRoots = [
    path.join(projectRoot, "client/src"),
    path.join(projectRoot, "electron"),
    path.join(projectRoot, "shared"),
    path.join(projectRoot, "server/src"),
  ];
  return sourceRoots.some((sourceRoot) => newestMtime(sourceRoot) > distTime);
}

if (needsBuild()) {
  runBuild();
}

const launchEnv = { ...process.env, ROLLOUT_LAUNCHED_FROM_DESKTOP: "1" };
delete launchEnv.ELECTRON_RUN_AS_NODE;

const launch = spawnSync(electronApp, ["."], {
  cwd: projectRoot,
  stdio: "inherit",
  env: launchEnv,
});

if ((launch.status ?? 1) !== 0) {
  console.error("Rollout Studio failed to launch.");
  process.exit(launch.status ?? 1);
}

process.exit(0);
