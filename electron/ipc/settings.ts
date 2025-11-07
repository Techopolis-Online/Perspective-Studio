import type { BrowserWindow, IpcMain } from 'electron';
import Store from 'electron-store';
import path from 'node:path';
import { app } from 'electron';

type AppSettings = {
  firstRun: boolean;
  mode: 'beginner' | 'power' | null;
  ollamaHost: string;
  modelsDir: string;
  hfToken?: string | null;
};

const schema = {
  firstRun: { type: 'boolean', default: true },
  mode: { type: ['string', 'null'], default: null },
  ollamaHost: { type: 'string', default: 'http://localhost:11434' },
  modelsDir: { type: 'string', default: path.join(app.getPath('userData'), 'models') },
  hfToken: { type: ['string', 'null'], default: null },
} as const;

const store = new Store<AppSettings>({ schema: schema as any, name: 'settings' });

export function getSettings(): AppSettings {
  return store.store;
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...store.store, ...partial } as AppSettings;
  store.store = next;
  return next;
}

export function registerSettingsIpc(ipcMain: IpcMain, win: BrowserWindow | null) {
  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:update', (_evt, partial: Partial<AppSettings>) => {
    const next = updateSettings(partial);
    win?.webContents.send('settings:changed', next);
    return next;
  });
}

export type { AppSettings };




