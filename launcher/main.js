const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { baseUrl: DEFAULT_URL } = require("./config");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 620,
    title: "ROBLOX 2021 REBORN", backgroundColor: "#f2f5f7",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("roblox://")) {
      event.preventDefault();
      shell.openExternal(url);
      return;
    }
    try {
      const target = new URL(url);
      const home = new URL(DEFAULT_URL);
      if (target.origin !== home.origin) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });
  win.loadURL(DEFAULT_URL);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });