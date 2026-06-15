const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rolloutStudio", {
  platform: process.platform,
  isWidget: () => new URL(window.location.href).hash === "#widget",
  openMain: (projectId) => ipcRenderer.invoke("open-main", projectId),
  openWidget: () => ipcRenderer.invoke("open-widget"),
  reloadApp: () => ipcRenderer.invoke("reload-app"),
  closeWidget: () => ipcRenderer.invoke("close-widget"),
  toggleAlwaysOnTop: () => ipcRenderer.invoke("toggle-always-on-top"),
  quitApp: () => ipcRenderer.invoke("quit-app"),
});
