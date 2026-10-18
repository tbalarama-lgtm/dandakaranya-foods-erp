import { app, BrowserWindow, session, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_NAME } from "@shared/constants";
import { DatabaseManager } from "./db/connection";
import { resolveDataPaths } from "./db/paths";
import { registerIpc } from "./ipc/register";
import { installApplicationMenu } from "./menu";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let manager: DatabaseManager | null = null;

function isDev(): boolean {
  return !app.isPackaged;
}

function resolvePreload(): string {
  const candidates = ["index.mjs", "index.js", "index.cjs"];
  for (const name of candidates) {
    const candidate = path.join(__dirname, "../preload", name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(__dirname, "../preload/index.js");
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: "#f4f6f8",
    autoHideMenuBar: process.platform === "win32",
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (isDev() && devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function applySecurity(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev()
      ? "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp]
      }
    });
  });

  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https:") || url.startsWith("http:")) {
        void shell.openExternal(url);
      }
      return { action: "deny" };
    });
    contents.on("will-navigate", (event, url) => {
      const allowed =
        url.startsWith("file:") ||
        (isDev() && (url.startsWith("http://localhost:") || url.startsWith("http://127.0.0.1:")));
      if (!allowed) event.preventDefault();
    });
  });
}

app.whenReady().then(() => {
  applySecurity();
  manager = new DatabaseManager(resolveDataPaths(app.getPath("userData")));
  registerIpc(manager, () => mainWindow);
  try {
    manager.open();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("WIN WIN failed to open the database:", message);
  }
  installApplicationMenu(() => mainWindow);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  manager?.close();
});
