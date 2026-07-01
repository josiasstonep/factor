import { app, BrowserWindow, dialog } from "electron";
import path from "path";
import { ensureSidecar, stopSidecar } from "./sidecar";

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  try {
    await ensureSidecar();
  } catch (err) {
    dialog.showErrorBox("Erro ao iniciar", err instanceof Error ? err.message : String(err));
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(process.resourcesPath, "web", "index.html"));
  } else {
    void mainWindow.loadURL("http://localhost:5173");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  void createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on("window-all-closed", () => {
  stopSidecar();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopSidecar();
});
