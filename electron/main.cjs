const { app, BrowserWindow, shell, Tray, Menu, nativeImage } = require("electron");
const path = require("node:path");

const isPackaged = app.isPackaged;
const useViteDevServer = !isPackaged && process.env.ROLLOUT_USE_VITE === "1";
const API_PORT = process.env.ROLLOUT_PORT || "3847";
let widgetWindow = null;
let mainWindow = null;
let tray = null;

if (isPackaged && process.platform === "darwin") {
  app.disableHardwareAcceleration();
}

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

function startBackend() {
  if (useViteDevServer) {
    return Promise.resolve();
  }

  process.env.ROLLOUT_DATA_DIR = app.getPath("userData");
  process.env.ROLLOUT_PORT = String(API_PORT);

  try {
    require(getServerEntry());
  } catch (error) {
    return Promise.reject(error);
  }

  return waitForBackend();
}

function attachExternalLinks(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function loadWindowContent(win, hash = "") {
  if (useViteDevServer) {
    const suffix = hash ? `#${hash}` : "";
    win.loadURL(`http://127.0.0.1:5173/${suffix}`);
    return;
  }

  win.loadFile(getClientIndex(), hash ? { hash } : undefined);
}

function createWidgetWindow() {
  if (widgetWindow) {
    widgetWindow.show();
    widgetWindow.focus();
    return widgetWindow;
  }

  widgetWindow = new BrowserWindow({
    width: 360,
    height: 520,
    minWidth: 320,
    minHeight: 420,
    maxWidth: 420,
    show: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: true,
    title: "Rollout Widget",
    backgroundColor: "#0f1115",
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

  loadWindowContent(widgetWindow, "widget");

  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });

  return widgetWindow;
}

function createMainWindow(projectId) {
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  );
  tray = new Tray(icon);
  tray.setToolTip("Rollout Studio");

  const menu = Menu.buildFromTemplate([
    {
      label: "Show Widget",
      click: () => createWidgetWindow(),
    },
    {
      label: "Open Full App",
      click: () => createMainWindow(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(menu);
  tray.on("click", () => {
    if (widgetWindow) {
      widgetWindow.isVisible() ? widgetWindow.hide() : widgetWindow.show();
    } else {
      createWidgetWindow();
    }
  });
}

function registerIpc() {
  const { ipcMain } = require("electron");

  ipcMain.handle("open-main", (_event, projectId) => {
    createMainWindow(projectId);
  });

  ipcMain.handle("toggle-always-on-top", () => {
    if (!widgetWindow) return false;
    const next = !widgetWindow.isAlwaysOnTop();
    widgetWindow.setAlwaysOnTop(next, "floating");
    return next;
  });

  ipcMain.handle("quit-app", () => {
    app.quit();
  });
}

app.whenReady().then(async () => {
  registerIpc();

  try {
    await startBackend();
  } catch (error) {
    console.error("Failed to start Rollout Studio backend:", error);
  }

  createTray();
  createWidgetWindow();

  app.on("activate", () => {
    if (!widgetWindow && !mainWindow) {
      createWidgetWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
