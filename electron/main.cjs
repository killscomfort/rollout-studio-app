const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

const isDev = !app.isPackaged;
const API_PORT = process.env.ROLLOUT_PORT || "3847";
let serverProcess = null;

function startBackend() {
  if (isDev) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const serverEntry = path.join(__dirname, "../server/dist/server/src/index.js");
    serverProcess = spawn(process.execPath, [serverEntry], {
      env: {
        ...process.env,
        ROLLOUT_PORT: API_PORT,
        NODE_ENV: "production",
      },
      stdio: "inherit",
    });

    serverProcess.on("error", reject);

    const check = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${API_PORT}/health`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // retry
      }
      setTimeout(check, 250);
    };

    setTimeout(check, 500);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    title: "Rollout Studio",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../client/dist/index.html"));
  }
}

app.whenReady().then(async () => {
  await startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
