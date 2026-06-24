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
  const result = spawnSync(runner.command, [path.join(projectRoot, "scripts/run-build.cjs")], {
    cwd: projectRoot,
    stdio: "inherit",
    env: runner.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
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
