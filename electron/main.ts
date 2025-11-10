import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerSettingsIpc } from './ipc/settings.js';
import { registerOllamaIpc } from './ipc/ollama.js';
import { registerSystemIpc } from './ipc/system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !!process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'Perspective Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on('ready-to-show', () => win.show());

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexHtmlPath = path.join(__dirname, '../renderer/index.html');
    win.loadFile(indexHtmlPath);
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    // open external links in default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  // security: limit navigation (apply CSP only in production so Vite dev HMR isn't blocked)
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://ollama.com http://localhost:11434";
      const headers = details.responseHeaders || {};
      headers['Content-Security-Policy'] = [csp];
      callback({ responseHeaders: headers });
    });
  }

  mainWindow = createMainWindow();

  // Register IPC modules
  registerSettingsIpc(ipcMain, mainWindow);
  registerOllamaIpc(ipcMain, mainWindow);
  registerSystemIpc(ipcMain, mainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});


