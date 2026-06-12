const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");

function resolveNodeRunner() {
  const electronNode = path.join(
    projectRoot,
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
      useShell: false,
    };
  }

  return { command: "node", env: process.env, useShell: false };
}

function run(label, args) {
  console.log(`\n▶ ${label}`);
  const npm = spawnSync("npm", args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (npm.error?.code === "ENOENT" || npm.status === 127) {
    const runner = resolveNodeRunner();
    if (label === "Typecheck") {
      const tsc = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");
      for (const tsconfig of ["server/tsconfig.json", "client/tsconfig.json"]) {
        const step = spawnSync(runner.command, [tsc, "-p", tsconfig, "--noEmit"], {
          cwd: projectRoot,
          stdio: "inherit",
          env: runner.env,
        });
        if (step.status !== 0) {
          process.exit(step.status ?? 1);
        }
      }
      return;
    }

    if (label === "Build") {
      const vite = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
      const buildEnv = {
        ...runner.env,
        VITE_API_BASE: "http://127.0.0.1:3847",
      };
      const client = spawnSync(
        runner.command,
        [vite, "build", "--config", "client/vite.config.ts"],
        { cwd: projectRoot, stdio: "inherit", env: buildEnv }
      );
      if (client.status !== 0) {
        process.exit(client.status ?? 1);
      }

      const tsc = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");
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
      return;
    }
  }

  if (npm.status !== 0) {
    process.exit(npm.status ?? 1);
  }
}

run("Typecheck", ["run", "typecheck"]);
run("Build", ["run", "build"]);
console.log("\n✓ All checks passed.");
