const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("rolloutStudio", {
  platform: process.platform,
});
