const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const projectRoot = path.join(__dirname, "..");
const desktopDir = path.join(os.homedir(), "Desktop");
const appName = "Rollout Studio.app";
const launcherName = "Rollout Studio.command";
const destApp = path.join(desktopDir, appName);
const destLauncher = path.join(desktopDir, launcherName);
const nodeShim = path.join(projectRoot, "scripts/bin/node");
const electronBinary = path.join(
  projectRoot,
  "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
);

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

function runBuild() {
  const runner = fs.existsSync(nodeShim) ? nodeShim : "node";
  console.log("Building latest Rollout Studio…");
  const result = spawnSync(runner, [path.join(projectRoot, "scripts/check.cjs")], {
    cwd: projectRoot,
    stdio: "inherit",
    env: fs.existsSync(nodeShim)
      ? { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
      : process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function launcherScript() {
  const nodeBin = resolveNodeBin();
  const nodeRunner = fs.existsSync(nodeShim) ? nodeShim : "node";
  const pathExports = [
    nodeBin ? `export PATH="${nodeBin}:$PATH"` : null,
    `export PATH="${path.join(projectRoot, "scripts/bin")}:$PATH"`,
  ]
    .filter(Boolean)
    .join("\n");

  return `#!/bin/bash
set -euo pipefail
${pathExports}
cd "${projectRoot}"
exec "${nodeRunner}" "${path.join(projectRoot, "scripts/start-local.cjs")}"
`;
}

function writeCommandLauncher() {
  fs.writeFileSync(destLauncher, launcherScript(), { mode: 0o755 });
  spawnSync("xattr", ["-cr", destLauncher], { stdio: "ignore" });
  console.log(`Installed launcher at ${destLauncher}`);
}

function copyIconIfAvailable(resourcesDir) {
  const candidates = [
    path.join(
      projectRoot,
      "release/mac-arm64/Rollout Studio.app/Contents/Resources/electron.icns"
    ),
    path.join(
      projectRoot,
      "node_modules/electron/dist/Electron.app/Contents/Resources/electron.icns"
    ),
  ];

  for (const source of candidates) {
    if (!fs.existsSync(source)) continue;
    fs.copyFileSync(source, path.join(resourcesDir, "AppIcon.icns"));
    return true;
  }

  return false;
}

function createDesktopAppBundle() {
  const contentsDir = path.join(destApp, "Contents");
  const macOsDir = path.join(contentsDir, "MacOS");
  const resourcesDir = path.join(contentsDir, "Resources");
  const executableName = "Rollout Studio";

  if (fs.existsSync(destApp)) {
    spawnSync("rm", ["-rf", destApp], { stdio: "inherit" });
  }

  fs.mkdirSync(macOsDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });

  const executablePath = path.join(macOsDir, executableName);
  fs.writeFileSync(executablePath, launcherScript(), { mode: 0o755 });

  const hasIcon = copyIconIfAvailable(resourcesDir);
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>${executableName}</string>
  <key>CFBundleIdentifier</key>
  <string>com.rolloutstudio.app.launcher</string>
  <key>CFBundleName</key>
  <string>Rollout Studio</string>
  <key>CFBundleDisplayName</key>
  <string>Rollout Studio</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  ${
    hasIcon
      ? `<key>CFBundleIconFile</key>
  <string>AppIcon</string>`
      : ""
  }
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>`;

  fs.writeFileSync(path.join(contentsDir, "Info.plist"), plist);
  spawnSync("xattr", ["-cr", destApp], { stdio: "ignore" });
  console.log(`Installed app at ${destApp}`);
}

function ensureRuntimeExists() {
  if (!fs.existsSync(electronBinary)) {
    console.error("Electron is not installed. Run npm install in the project first.");
    process.exit(1);
  }
}

ensureRuntimeExists();
runBuild();
writeCommandLauncher();
createDesktopAppBundle();
console.log("Desktop app and command now launch the latest build from the project.");
