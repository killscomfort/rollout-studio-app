const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const projectRoot = path.join(__dirname, "..");
const releaseDir = path.join(projectRoot, "release");
const desktopDir = path.join(os.homedir(), "Desktop");
const appName = "Rollout Studio.app";
const launcherName = "Rollout Studio.command";
const destApp = path.join(desktopDir, appName);
const destLauncher = path.join(desktopDir, launcherName);
const nodeBin = "/Users/toejam808/Desktop/KillsAi/code/.node/bin";

function findBuiltApp(dir) {
  if (!fs.existsSync(dir)) return null;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.endsWith(".app")) {
        return fullPath;
      }
      const nested = findBuiltApp(fullPath);
      if (nested) return nested;
    }
  }

  return null;
}

function writeLauncher() {
  const script = `#!/bin/bash
export PATH="${nodeBin}:$PATH"
cd "${projectRoot}"
npm start
`;

  fs.writeFileSync(destLauncher, script, { mode: 0o755 });
  spawnSync("xattr", ["-cr", destLauncher], { stdio: "ignore" });
  console.log(`Installed launcher on Desktop at ${destLauncher}`);
}

writeLauncher();

const builtApp = findBuiltApp(releaseDir);
if (!builtApp) {
  console.warn("No packaged .app found. Desktop launcher is ready to use.");
  process.exit(0);
}

if (fs.existsSync(destApp)) {
  fs.rmSync(destApp, { recursive: true, force: true });
}

const copy = spawnSync("ditto", [builtApp, destApp], { stdio: "inherit" });
if (copy.status !== 0) {
  process.exit(copy.status ?? 1);
}

spawnSync("xattr", ["-cr", destApp], { stdio: "ignore" });
console.log(`Installed ${appName} on Desktop at ${destApp}`);
