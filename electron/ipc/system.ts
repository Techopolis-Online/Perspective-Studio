import type { BrowserWindow, IpcMain } from 'electron';
import os from 'node:os';

export function registerSystemIpc(ipcMain: IpcMain, _win: BrowserWindow | null) {
  ipcMain.handle('system:memory', () => {
    const totalMemBytes = os.totalmem();
    return { totalMemBytes };
  });
}


