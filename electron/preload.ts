import { contextBridge, ipcRenderer } from 'electron';

type ChatCallbacks = {
  onToken?: (chunk: string) => void;
  onCompleted?: () => void;
  onError?: (message: string) => void;
};

contextBridge.exposeInMainWorld('api', {
  menu: {
    onNewChat: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('menu:new-chat', handler);
      return () => ipcRenderer.removeListener('menu:new-chat', handler);
    },
    onNavigate: (cb: (view: 'Chat' | 'Catalog' | 'Downloads' | 'Settings') => void) => {
      const handler = (_: unknown, payload: { view: 'Chat' | 'Catalog' | 'Downloads' | 'Settings' }) => cb(payload.view);
      ipcRenderer.on('menu:navigate', handler);
      return () => ipcRenderer.removeListener('menu:navigate', handler);
    },
    onOpenChat: (cb: (id: string) => void) => {
      const handler = (_: unknown, payload: { id: string }) => cb(payload.id);
      ipcRenderer.on('menu:open-chat', handler);
      return () => ipcRenderer.removeListener('menu:open-chat', handler);
    },
    setRecentChats: (items: Array<{ id: string; title: string }>) => ipcRenderer.invoke('menu:setRecentChats', { items }),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (partial: Record<string, unknown>) => ipcRenderer.invoke('settings:update', partial),
    onChanged: (cb: (s: any) => void) => {
      const handler = (_: unknown, s: any) => cb(s);
      ipcRenderer.on('settings:changed', handler);
      return () => ipcRenderer.removeListener('settings:changed', handler);
    },
  },
  ollama: {
    listModels: (): Promise<string[]> => ipcRenderer.invoke('ollama:listModels'),
    pull: (name: string, onStatus?: (s: string) => void): Promise<boolean> => {
      const id = crypto.randomUUID();
      const handler = (_: unknown, payload: { id: string; status: string }) => {
        if (payload.id === id && onStatus) onStatus(payload.status);
      };
      ipcRenderer.on('ollama:pull:status', handler);
      return ipcRenderer.invoke('ollama:pull', { id, name }).finally(() => {
        ipcRenderer.removeListener('ollama:pull:status', handler);
      });
    },
    chatStream: (
      args: { model: string; messages: Array<{ role: string; content: string }>; temperature: number },
      cbs: ChatCallbacks
    ): Promise<void> => {
      const id = crypto.randomUUID();
      const tokenHandler = (_: unknown, p: { id: string; chunk: string }) => {
        if (p.id === id) cbs.onToken && cbs.onToken(p.chunk);
      };
      const doneHandler = (_: unknown, p: { id: string }) => {
        if (p.id === id) cbs.onCompleted && cbs.onCompleted();
      };
      const errHandler = (_: unknown, p: { id: string; message: string }) => {
        if (p.id === id) cbs.onError && cbs.onError(p.message);
      };
      ipcRenderer.on('ollama:chat:token', tokenHandler);
      ipcRenderer.on('ollama:chat:done', doneHandler);
      ipcRenderer.on('ollama:chat:error', errHandler);
      return ipcRenderer
        .invoke('ollama:chat:start', { id, ...args })
        .catch((e) => cbs.onError && cbs.onError(String(e)))
        .finally(() => {
          const cleanup = () => {
            ipcRenderer.removeListener('ollama:chat:token', tokenHandler);
            ipcRenderer.removeListener('ollama:chat:done', doneHandler);
            ipcRenderer.removeListener('ollama:chat:error', errHandler);
          };
          ipcRenderer.once('ollama:chat:done', cleanup);
          ipcRenderer.once('ollama:chat:error', cleanup);
        });
    },
    isInstalled: (): Promise<boolean> => ipcRenderer.invoke('ollama:isInstalled'),
    ensureServer: (onStatus?: (s: string) => void): Promise<boolean> => {
      if (onStatus) {
        const handler = (_: unknown, p: { status: string }) => onStatus(p.status);
        ipcRenderer.on('ollama:ensure:status', handler);
        return ipcRenderer.invoke('ollama:ensureServer').finally(() => {
          ipcRenderer.removeListener('ollama:ensure:status', handler);
        });
      }
      return ipcRenderer.invoke('ollama:ensureServer');
    },
    install: (onStatus?: (s: string) => void): Promise<{ success: boolean; message?: string }> => {
      if (onStatus) {
        const handler = (_: unknown, p: { status: string }) => onStatus(p.status);
        ipcRenderer.on('ollama:ensure:status', handler);
        return ipcRenderer.invoke('ollama:install').finally(() => {
          ipcRenderer.removeListener('ollama:ensure:status', handler);
        });
      }
      return ipcRenderer.invoke('ollama:install');
    },
    checkUpdate: (): Promise<{ needsUpdate: boolean; currentVersion: string | null; latestVersion: string | null }> => 
      ipcRenderer.invoke('ollama:checkUpdate'),
    catalog: {
      search: (query: string, limit = 25) => ipcRenderer.invoke('ollama:catalog:search', { query, limit }),
      listTop: (limit = 25) => ipcRenderer.invoke('ollama:catalog:listTop', { limit }),
      getDescription: (name: string): Promise<{ description: string | null }> => ipcRenderer.invoke('ollama:catalog:getDescription', { name }),
    },
    deleteModel: (name: string): Promise<boolean> => ipcRenderer.invoke('ollama:deleteModel', { name }),
    deleteAllModels: (): Promise<{ success: boolean; message?: string }> => ipcRenderer.invoke('ollama:deleteAllModels'),
    uninstall: (): Promise<{ success: boolean; message?: string }> => ipcRenderer.invoke('ollama:uninstall'),
    resetEverything: (onStatus?: (s: string) => void): Promise<{ success: boolean; message?: string }> => {
      if (onStatus) {
        const handler = (_: unknown, p: { status: string }) => onStatus(p.status);
        ipcRenderer.on('ollama:reset:status', handler);
        return ipcRenderer.invoke('ollama:resetEverything').finally(() => {
          ipcRenderer.removeListener('ollama:reset:status', handler);
        });
      }
      return ipcRenderer.invoke('ollama:resetEverything');
    },
  },
  system: {
    memory: (): Promise<{ totalMemBytes: number }> => ipcRenderer.invoke('system:memory'),
  },
});

declare global {
  interface Window {
    api: any;
  }
}



