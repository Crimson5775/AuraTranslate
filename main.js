const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let win;
let tray;
let currentShortcut = "Control+Shift+Space";
let hideOnBlur = true;
let justShown = false;

// Window state management
const configPath = path.join(app.getPath("userData"), "window-state.json");
let windowState = { width: 900, height: 560 };

function loadWindowState() {
  try {
    if (fs.existsSync(configPath)) {
      windowState = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (e) {
    console.error("Failed to load window state", e);
  }
}

function saveWindowState() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(windowState), "utf8");
  } catch (e) {
    console.error("Failed to save window state", e);
  }
}

function showWindow() {
  if (!win) return;
  justShown = true;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents.send("focus-input");
  setTimeout(() => {
    justShown = false;
  }, 300);
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    if (win) {
      showWindow();
      dialog.showMessageBox(win, {
        type: "info",
        title: "AuraTranslate",
        message: "AuraTranslate is already running in the background.",
        detail: "Use your hotkey or click the system tray icon to open it."
      });
    }
  });
}

function createWindow() {
  loadWindowState();

  win = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    minWidth: 700,
    minHeight: 400,
    maxWidth: 1600,
    maxHeight: 1200,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: true,
    show: false,
    skipTaskbar: true, // Hide on Blur defaults to true, so we skip taskbar on start
    alwaysOnTop: true, // Keep it floating like a true command palette
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Center window on screen if no state was saved yet
  if (!fs.existsSync(configPath)) {
    win.center();
  }

  // Load app (Dev vs Production)
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "dist/index.html"));
  }

  win.once("ready-to-show", () => {
    showWindow();
    if (process.platform === "win32" && typeof win.setBorderColor === "function") {
      win.setBorderColor("#16161a"); // Initial dark theme border
    }
  });

  // Save state on resize
  win.on("resize", () => {
    if (win && !win.isMaximized() && !win.isMinimized()) {
      const [width, height] = win.getSize();
      windowState.width = width;
      windowState.height = height;
      saveWindowState();
    }
  });

  // Hide window when it loses focus (blur) - Raycast behavior
  win.on("blur", () => {
    if (justShown) return;
    if (win && !win.isMinimized() && !win.webContents.isDevToolsOpened() && hideOnBlur) {
      win.hide();
    }
  });

  // Ensure window is shown in taskbar when minimized, and skipped otherwise based on hideOnBlur
  win.on("minimize", () => {
    if (win) win.setSkipTaskbar(false);
  });

  win.on("restore", () => {
    if (win) win.setSkipTaskbar(!hideOnBlur);
  });

  win.on("focus", () => {
    if (win) win.setSkipTaskbar(!hideOnBlur);
  });

  // Prevent window close from quitting the app (stay in background)
  win.on("close", (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      win.hide();
    }
    return false;
  });
}

function createTray() {
  // Simple base64 PNG representing a small translation speech bubble icon
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAh5JREFUeNpsU01rE1EUvfe9mczEJE2bphFr2lQRTItWsGBWduNGKyIoCIoK/gA3gqBLceFG3YgbV34IKCoqCDoWhC4siGsRglJtUzVpGpvMTGbmvXfuTCalHzw4nHnv3nvOfS8hyzLkX5442n01gZ2NAsIwhK6r8H0fvu/DdV0IIaCqKiRJAuK2+fF6456E/P5WcTeb0aEoCgzDQBQE0FqjtQatNXhnYBgGZFmG4zhgM10c+5409W+bT/bW+m/P6+r7eYlCCo7jgDEGm816v6W1hqZpEEUB3/40j50mHyyXG/fW1wQe5Kfw6UvjO1zP3uK4DlmWwRiDpmkwDAOGYYDnefDeEASBEP6wD/Lz23W+t5Kfl8ikNPA8D7quQ5IkSJKEOI5BqN5DURRIkoRutzM4wXq6X/7l4u0M5fI52LaNYrEIz/PgOA6y2SycVgvdbheEkJ2o5fTfH5Q/FEnK5TKKxSIcx0G1WoVpmjBNExzHwXXdC0p9eL/e/ZklybIElmXBsixIkoRyuQzbtsEYg6ZpEEUBpmmiaZoQWqP39MefN6K93N/h2x/m0TRN+L4P3/chSRJc172g1PuPx1uN5iWSwO8d37422kIIg9YaWmsIIXifgRACPp8D/gH74mD821mSpNlswjAMKIoC/pY/N/2H96s9wUf/q/P3z91EEnPZDEzTvD8a2I+zV/vj3/6YvwIMAO5X6F/qBPhCAAAAAElFTkSuQmCC"
  );

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show AuraTranslate",
      click: () => {
        showWindow();
      }
    },
    {
      label: "Hide to Tray",
      click: () => {
        if (win) win.hide();
      }
    },
    { type: "separator" },
    {
      label: "Quit AuraTranslate",
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip("AuraTranslate");
  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    if (win) {
      if (win.isVisible() && win.isFocused()) {
        win.hide();
      } else {
        showWindow();
      }
    }
  });
}

// --- Global Shortcut Helper ---
function registerShortcut(shortcut) {
  try {
    if (currentShortcut) {
      globalShortcut.unregister(currentShortcut);
    }
    
    currentShortcut = shortcut;
    
    if (!shortcut) return true;

    const registered = globalShortcut.register(shortcut, () => {
      if (win) {
        if (win.isVisible() && win.isFocused()) {
          win.hide();
        } else {
          showWindow();
        }
      }
    });

    if (!registered) {
      console.error(`Failed to register shortcut: ${shortcut}`);
      return false;
    }
    console.log(`Successfully registered shortcut: ${shortcut}`);
    return true;
  } catch (err) {
    console.error("Error registering shortcut:", err);
    return false;
  }
}

// --- App Lifecycle ---
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Register default shortcut initially
  registerShortcut(currentShortcut);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// --- IPC Communication Handler ---
ipcMain.handle("toggle-startup", (event, enabled) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: app.getPath("exe")
    });
    console.log(`Startup status changed to: ${enabled}`);
    return true;
  } catch (err) {
    console.error("Failed to toggle startup status:", err);
    return false;
  }
});

ipcMain.handle("get-startup-status", () => {
  try {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  } catch (err) {
    console.error("Failed to get startup status:", err);
    return false;
  }
});

const keyMap = {
  "Backquote": "`",
  "Minus": "-",
  "Equal": "=",
  "BracketLeft": "[",
  "BracketRight": "]",
  "Backslash": "\\",
  "Semicolon": ";",
  "Quote": "'",
  "Comma": ",",
  "Period": ".",
  "Slash": "/",
  "ArrowUp": "Up",
  "ArrowDown": "Down",
  "ArrowLeft": "Left",
  "ArrowRight": "Right",
  "CapsLock": "Capslock",
  "Escape": "Escape"
};

ipcMain.handle("set-global-shortcut", (event, shortcut) => {
  if (!shortcut) return false;
  
  let parts = shortcut.split("+").map(part => {
    // Normalize modifier keys to standard Electron names (using 'Ctrl' is safest)
    if (part === "ControlLeft" || part === "ControlRight" || part === "Control") return "Ctrl";
    if (part === "AltLeft" || part === "AltRight" || part === "Alt") return "Alt";
    if (part === "ShiftLeft" || part === "ShiftRight" || part === "Shift") return "Shift";
    if (part === "MetaLeft" || part === "MetaRight" || part === "Meta" || part === "Super") return "Super";
    
    // Remove Key/Digit prefix for standard characters
    let cleanPart = part;
    if (cleanPart.startsWith("Key")) {
      cleanPart = cleanPart.substring(3);
    } else if (cleanPart.startsWith("Digit")) {
      cleanPart = cleanPart.substring(5);
    }
    
    // Translate browser physical codes to Electron accelerator characters
    return keyMap[cleanPart] || cleanPart;
  });
  
  let nativeShortcut = parts.join("+");
  console.log(`Registering native global shortcut: ${nativeShortcut}`);
  return registerShortcut(nativeShortcut);
});

ipcMain.handle("set-theme-border", (event, themeName) => {
  if (win && typeof win.setBorderColor === "function") {
    try {
      if (themeName === "light") {
        win.setBorderColor("#e4e4e7"); // Light grey
      } else if (themeName === "glass") {
        win.setBorderColor("#1f1f2e"); // Darker translucent
      } else {
        win.setBorderColor("#16161a"); // Dark theme
      }
      return true;
    } catch (e) {
      console.error("Failed to set border color:", e);
    }
  }
  return false;
});

ipcMain.handle("get-global-shortcut", () => {
  return currentShortcut;
});

ipcMain.handle("set-hide-on-blur", (event, value) => {
  hideOnBlur = value;
  if (win) {
    win.setSkipTaskbar(!hideOnBlur); // Hide from taskbar when hide-on-blur is enabled, show otherwise
  }
  console.log(`Hide-on-blur set to: ${hideOnBlur}`);
  return true;
});

ipcMain.on("close-app", () => {
  app.isQuiting = true;
  app.quit();
});

ipcMain.on("minimize-app", () => {
  if (win) win.minimize();
});

ipcMain.on("hide-app", () => {
  if (win) win.hide();
});

ipcMain.on("maximize-app", () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});
