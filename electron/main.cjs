const { app, BrowserWindow, shell, Tray, Menu, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const isPackaged = app.isPackaged;
const useViteDevServer = !isPackaged && process.env.ROLLOUT_USE_VITE === "1";

if (useViteDevServer) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
}
const API_PORT = process.env.ROLLOUT_PORT || "3847";
let widgetWindow = null;
let mainWindow = null;
let tray = null;
let appIsQuitting = false;

if (isPackaged && process.platform === "darwin" && process.env.ROLLOUT_DISABLE_GPU === "1") {
  app.disableHardwareAcceleration();
}

function loadEnvFile() {
  const envPath = path.join(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function readBuiltBackendMode() {
  const modePath = path.join(__dirname, "../client/dist/backend-mode.json");
  if (!fs.existsSync(modePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(modePath, "utf8"));
  } catch {
    return null;
  }
}

function usesCloudBackend() {
  if (process.env.ROLLOUT_USE_CLOUD === "1") {
    return true;
  }

  if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
    return true;
  }

  const builtMode = readBuiltBackendMode();
  return builtMode?.mode === "cloud";
}

loadEnvFile();
const useCloudBackend = usesCloudBackend();

function getServerEntry() {
  return path.join(__dirname, "../server/dist/server/src/index.js");
}

function getClientIndex() {
  return path.join(__dirname, "../client/dist/index.html");
}

function waitForBackend() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30000;

    const check = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${API_PORT}/health`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // retry until the API is ready
      }

      if (Date.now() > deadline) {
        reject(new Error("Rollout Studio API failed to start"));
        return;
      }

      setTimeout(check, 250);
    };

    setTimeout(check, 250);
  });
}

async function backendAlreadyRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${API_PORT}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function startBackend() {
  if (useCloudBackend) {
    return;
  }

  if (useViteDevServer) {
    return waitForBackend();
  }

  if (await backendAlreadyRunning()) {
    return;
  }

  process.env.ROLLOUT_DATA_DIR = app.getPath("userData");
  process.env.ROLLOUT_PORT = String(API_PORT);

  try {
    require(getServerEntry());
  } catch (error) {
    if (await backendAlreadyRunning()) {
      return;
    }
    return Promise.reject(error);
  }

  return waitForBackend();
}

function attachExternalLinks(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("console-message", (...args) => {
    const event = args[0];
    const level =
      typeof event === "object" && event && "level" in event ? event.level : args[1];
    const message =
      typeof event === "object" && event && "message" in event
        ? event.message
        : args[2];
    const lineNumber =
      typeof event === "object" && event && "lineNumber" in event
        ? event.lineNumber
        : args[3];
    const sourceId =
      typeof event === "object" && event && "sourceId" in event
        ? event.sourceId
        : args[4];

    if (level >= 2 && !String(message).includes("Electron Security Warning")) {
      console.error(`[renderer] ${message} (${sourceId}:${lineNumber})`);
    }
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer crashed:", details.reason);
  });
}

function loadWindowContent(win, hash = "") {
  if (useViteDevServer) {
    const url = hash
      ? `http://127.0.0.1:5173/#${hash}`
      : "http://127.0.0.1:5173/";
    win.loadURL(url);
    return;
  }

  win.loadFile(getClientIndex(), hash ? { hash } : undefined);
}

function createWidgetWindow() {
  if (widgetWindow) {
    widgetWindow.webContents.reload();
    widgetWindow.show();
    widgetWindow.focus();
    return widgetWindow;
  }

  widgetWindow = new BrowserWindow({
    width: 380,
    height: 680,
    minWidth: 320,
    minHeight: 480,
    show: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: true,
    title: "Rollout Widget",
    backgroundColor: "#8ec9f5",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  attachExternalLinks(widgetWindow);

  widgetWindow.once("ready-to-show", () => {
    widgetWindow.show();
  });

  widgetWindow.on("close", (event) => {
    if (!appIsQuitting) {
      event.preventDefault();
      widgetWindow.hide();
    }
  });

  loadWindowContent(widgetWindow, "widget");

  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });

  return widgetWindow;
}

function showMainWindow(projectId) {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    if (projectId) {
      mainWindow.webContents.executeJavaScript(
        `window.location.hash = ${JSON.stringify(`open/${projectId}`)}; window.dispatchEvent(new HashChangeEvent('hashchange'));`
      );
    }
    return mainWindow;
  }

  return createMainWindow(projectId);
}

function createMainWindow(projectId) {
  if (mainWindow) {
    return showMainWindow(projectId);
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    title: "Rollout Studio",
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  attachExternalLinks(mainWindow);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  loadWindowContent(mainWindow, projectId ? `open/${projectId}` : "");

  mainWindow.on("close", (event) => {
    if (!appIsQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

function createTrayIcon() {
  const size = 16;
  const canvas = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16">
      <rect width="16" height="16" rx="4" fill="#5b8cff"/>
      <path d="M4 5h8v1.5H4V5zm0 3h8v1.5H4V8zm0 3h5v1.5H4V11z" fill="#ffffff"/>
    </svg>
  `;

  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(canvas).toString("base64")}`
  );
}

function reloadWindows() {
  if (mainWindow) {
    mainWindow.webContents.reload();
  }
  if (widgetWindow) {
    widgetWindow.webContents.reload();
  }
}

function createApplicationMenu() {
  if (process.platform !== "darwin") return;

  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Open Widget",
          accelerator: "CmdOrCtrl+Shift+W",
          click: () => createWidgetWindow(),
        },
        {
          label: "Reload App",
          accelerator: "CmdOrCtrl+R",
          click: () => reloadWindows(),
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Navigate",
      submenu: [
        {
          label: "Back",
          accelerator: "CmdOrCtrl+[",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(
                "window.dispatchEvent(new CustomEvent('rollout-nav-back'));"
              );
            }
          },
        },
        {
          label: "Forward",
          accelerator: "CmdOrCtrl+]",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(
                "window.dispatchEvent(new CustomEvent('rollout-nav-forward'));"
              );
            }
          },
        },
        { type: "separator" },
        {
          label: "All Projects",
          accelerator: "CmdOrCtrl+1",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(
                "window.dispatchEvent(new CustomEvent('rollout-nav-projects'));"
              );
            }
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "toggleDevTools" },
        { role: "reload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("Rollout Studio");

  const menu = Menu.buildFromTemplate([
    {
      label: "Show Widget",
      click: () => createWidgetWindow(),
    },
    {
      label: "Open Full App",
      click: () => showMainWindow(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        appIsQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on("click", () => {
    if (widgetWindow?.isVisible()) {
      widgetWindow.hide();
      return;
    }
    createWidgetWindow();
  });
}

function registerIpc() {
  const { ipcMain } = require("electron");

  ipcMain.handle("open-main", (_event, projectId) => {
    showMainWindow(projectId);
  });

  ipcMain.handle("open-widget", () => {
    createWidgetWindow();
  });

  ipcMain.handle("close-widget", () => {
    if (widgetWindow) {
      widgetWindow.hide();
    }
  });

  ipcMain.handle("toggle-always-on-top", () => {
    if (!widgetWindow) return false;
    const next = !widgetWindow.isAlwaysOnTop();
    widgetWindow.setAlwaysOnTop(next, "floating");
    return next;
  });

  ipcMain.handle("reload-app", () => {
    reloadWindows();
  });

  ipcMain.handle("quit-app", () => {
    appIsQuitting = true;
    app.quit();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });
}

app.on("before-quit", () => {
  appIsQuitting = true;
});

app.whenReady().then(async () => {
  registerIpc();
  createApplicationMenu();

  try {
    await startBackend();
  } catch (error) {
    console.error("Failed to start Rollout Studio backend:", error);
  }

  createTray();
  showMainWindow();
  createWidgetWindow();

  app.on("activate", () => {
    showMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
