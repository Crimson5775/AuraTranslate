const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  toggleStartup: (enabled) => ipcRenderer.invoke("toggle-startup", enabled),
  getStartupStatus: () => ipcRenderer.invoke("get-startup-status"),
  setGlobalShortcut: (shortcut) => ipcRenderer.invoke("set-global-shortcut", shortcut),
  getGlobalShortcut: () => ipcRenderer.invoke("get-global-shortcut"),
  closeApp: () => ipcRenderer.send("close-app"),
  minimizeApp: () => ipcRenderer.send("minimize-app"),
  hideApp: () => ipcRenderer.send("hide-app"),
  maximizeApp: () => ipcRenderer.send("maximize-app"),
  setHideOnBlur: (enabled) => ipcRenderer.invoke("set-hide-on-blur", enabled),
  setThemeBorder: (theme) => ipcRenderer.invoke("set-theme-border", theme),
  onFocusInput: (callback) => ipcRenderer.on("focus-input", () => callback()),
  isElectron: true
});
