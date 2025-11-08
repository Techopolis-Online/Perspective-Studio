import { app, BrowserWindow, ipcMain, shell, session, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerSettingsIpc } from './ipc/settings.js';
import { registerOllamaIpc } from './ipc/ollama.js';
import { registerSystemIpc } from './ipc/system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !!process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let recentChats: Array<{ id: string; title: string }> = [];

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'perspective studio',
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

function buildAppMenu(win: BrowserWindow) {
  const isMac = process.platform === 'darwin';

  const fileMenu = {
    label: 'File',
    submenu: [
      {
        label: 'New Chat',
        accelerator: 'CmdOrCtrl+N',
        click: () => win.webContents.send('menu:new-chat'),
      },
      {
        label: 'Recent Chats',
        submenu:
          recentChats.length > 0
            ? recentChats.slice(0, 10).map((c) => ({
                label: c.title || 'Untitled Chat',
                click: () => win.webContents.send('menu:open-chat', { id: c.id }),
              }))
            : [{ label: 'No recent chats', enabled: false }],
      },
      { type: 'separator' as const },
      {
        label: 'Settings…',
        accelerator: 'CmdOrCtrl+,',
        click: () => win.webContents.send('menu:navigate', { view: 'Settings' }),
      },
      ...(isMac
        ? [{ role: 'close' as const }]
        : [{ role: 'quit' as const }]),
    ],
  };

  const windowMenu = {
    label: 'Window',
    submenu: [
      {
        label: 'Chat',
        accelerator: 'CmdOrCtrl+1',
        click: () => win.webContents.send('menu:navigate', { view: 'Chat' }),
      },
      {
        label: 'Catalog',
        accelerator: 'CmdOrCtrl+2',
        click: () => win.webContents.send('menu:navigate', { view: 'Catalog' }),
      },
      {
        label: 'Downloads',
        accelerator: 'CmdOrCtrl+3',
        click: () => win.webContents.send('menu:navigate', { view: 'Downloads' }),
      },
      {
        label: 'Settings',
        accelerator: 'CmdOrCtrl+4',
        click: () => win.webContents.send('menu:navigate', { view: 'Settings' }),
      },
      { type: 'separator' as const },
      { role: 'minimize' as const },
      ...(isMac ? [{ role: 'zoom' as const }] : []),
      { role: 'close' as const },
      ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
    ],
  };

  const editMenu = {
    label: 'Edit',
    submenu: [
      { role: 'undo' as const },
      { role: 'redo' as const },
      { type: 'separator' as const },
      { role: 'cut' as const },
      { role: 'copy' as const },
      { role: 'paste' as const },
      ...(isMac ? [{ role: 'pasteAndMatchStyle' as const }] : []),
      { role: 'selectAll' as const },
    ],
  };

  const viewMenu = {
    label: 'View',
    submenu: [
      { role: 'reload' as const },
      ...(process.env.VITE_DEV_SERVER_URL ? [{ role: 'toggleDevTools' as const }] : []),
      { type: 'separator' as const },
      { role: 'resetZoom' as const },
      { role: 'zoomIn' as const },
      { role: 'zoomOut' as const },
      { type: 'separator' as const },
      { role: 'togglefullscreen' as const },
    ],
  };

  const helpMenu = {
    role: 'help' as const,
    submenu: [
      {
        label: 'Documentation',
        click: () => shell.openExternal('https://github.com/taylorarndt/Perspective-Studio#readme'),
      },
      {
        label: 'Report an Issue',
        click: () => shell.openExternal('https://github.com/taylorarndt/Perspective-Studio/issues'),
      },
    ],
  };

  const template = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    fileMenu,
    editMenu,
    viewMenu,
    windowMenu,
    helpMenu,
  ];

  const menu = Menu.buildFromTemplate(template as any);
  Menu.setApplicationMenu(menu);
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
  if (mainWindow) buildAppMenu(mainWindow);

  // Register IPC modules
  registerSettingsIpc(ipcMain, mainWindow);
  registerOllamaIpc(ipcMain, mainWindow);
  registerSystemIpc(ipcMain, mainWindow);

  // Menu updaters
  ipcMain.handle('menu:setRecentChats', (_evt, payload: { items: Array<{ id: string; title: string }> }) => {
    recentChats = Array.isArray(payload?.items) ? payload.items.slice(0, 10) : [];
    if (mainWindow) buildAppMenu(mainWindow);
    return true;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});


