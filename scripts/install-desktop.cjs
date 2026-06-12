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

function resolveNodeBin() {
  const candidates = [
    process.env.ROLLOUT_NODE_BIN,
    "/opt/homebrew/bin",
    "/usr/local/bin",
    path.join(os.homedir(), ".nvm", "versions", "node"),
    path.join(os.homedir(), ".fnm", "current", "bin"),
    path.join(os.homedir(), ".volta", "bin"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.endsWith("/node") || candidate.endsWith("\\node")) {
      if (fs.existsSync(candidate)) {
        return path.dirname(candidate);
      }
      continue;
    }

    const nodePath = path.join(candidate, "node");
    if (fs.existsSync(nodePath)) {
      return candidate;
    }

    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      const versions = fs
        .readdirSync(candidate, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(candidate, entry.name, "bin", "node"))
        .filter((nodeFile) => fs.existsSync(nodeFile));
      if (versions.length) {
        return path.dirname(versions[versions.length - 1]);
      }
    }
  }

  return "";
}

const nodeBin = resolveNodeBin();
const pathPrefix = [
  nodeBin ? `export PATH="${nodeBin}:$PATH"` : null,
  `export PATH="${projectRoot}/scripts/bin:$PATH"`,
]
  .filter(Boolean)
  .join("\n");

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
${pathPrefix}
cd "${projectRoot}"
if command -v npm >/dev/null 2>&1; then
  npm start
else
  node scripts/start-local.cjs
fi
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
  spawnSync("rm", ["-rf", destApp], { stdio: "inherit" });
}

const copy = spawnSync("ditto", [builtApp, destApp], { stdio: "inherit" });
if (copy.status !== 0) {
  process.exit(copy.status ?? 1);
}

spawnSync("xattr", ["-cr", destApp], { stdio: "ignore" });
console.log(`Installed ${appName} on Desktop at ${destApp}`);
