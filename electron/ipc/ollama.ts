import type { BrowserWindow, IpcMain } from 'electron';
import { getSettings, updateSettings } from './settings.js';
import { spawn } from 'node:child_process';
import os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app, shell } from 'electron';

async function listModels(): Promise<string[]> {
  const host = getSettings().ollamaHost.replace(/\/$/, '');
  try {
    const resp = await fetch(`${host}/api/tags`, { method: 'GET' });
    if (!resp.ok) return [];
    const data = (await resp.json()) as any;
    const items = Array.isArray(data?.models) ? data.models : [];
    const names: string[] = [];
    for (const it of items) {
      if (typeof it?.name === 'string') names.push(it.name);
    }
    return Array.from(new Set(names)).sort();
  } catch {
    return [];
  }
}

async function pullModel(win: BrowserWindow | null, id: string, name: string): Promise<boolean> {
  const host = getSettings().ollamaHost.replace(/\/$/, '');
  try {
    // If using local host, ensure Ollama is installed and the server is running before pulling
    let isLocal = false;
    try {
      const u = new URL(host);
      const h = (u.hostname || '').toLowerCase();
      isLocal = h === 'localhost' || h === '127.0.0.1' || h === '::1';
    } catch {}

    if (isLocal) {
      const installed = await isOllamaInstalled();
      if (!installed) {
        win?.webContents.send('ollama:pull:status', { id, status: 'Ollama not installed. Installing…' });
        const installRes = await installOllama(win);
        if (!installRes.success) {
          win?.webContents.send('ollama:pull:status', { id, status: installRes.message || 'Ollama installation failed.' });
          return false;
        }
      }
      win?.webContents.send('ollama:pull:status', { id, status: 'Ensuring Ollama server is running…' });
      const ok = await ensureOllamaRunning(win);
      if (!ok) {
        win?.webContents.send('ollama:pull:status', { id, status: 'Failed to start Ollama server.' });
        return false;
      }
    }

    const resp = await fetch(`${host}/api/pull`, {
      method: 'POST',
      body: JSON.stringify({ name }),
      headers: { 'Content-Type': 'application/json' },
    } as RequestInit);
    if (!resp.ok || !resp.body) return false;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          const status = obj.status || obj.digest || '';
          if (status) win?.webContents.send('ollama:pull:status', { id, status: String(status) });
        } catch {
          // ignore
        }
      }
    }
    const models = await listModels();
    return models.includes(name);
  } catch {
    return false;
  }
}

async function chatStream(
  win: BrowserWindow | null,
  args: { id: string; model: string; messages: Array<{ role: string; content: string }>; temperature: number }
): Promise<void> {
  const host = getSettings().ollamaHost.replace(/\/$/, '');
  const payload = {
    model: args.model,
    messages: args.messages,
    options: { temperature: args.temperature },
    stream: true,
  };
  try {
    const resp = await fetch(`${host}/api/chat`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    } as RequestInit);
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.done) {
            win?.webContents.send('ollama:chat:done', { id: args.id });
            return;
          }
          const content = obj?.message?.content || '';
          if (content) win?.webContents.send('ollama:chat:token', { id: args.id, chunk: String(content) });
        } catch (e) {
          // ignore
        }
      }
    }
    win?.webContents.send('ollama:chat:done', { id: args.id });
  } catch (e: any) {
    win?.webContents.send('ollama:chat:error', { id: args.id, message: String(e?.message || e) });
  }
}

async function deleteAllModels(win: BrowserWindow | null): Promise<{ success: boolean; message?: string }> {
  try {
    win?.webContents.send('ollama:reset:status', { status: 'Deleting all models...' });
    
    const host = getSettings().ollamaHost.replace(/\/$/, '');
    const models = await listModels();
    
    for (const model of models) {
      try {
        win?.webContents.send('ollama:reset:status', { status: `Deleting ${model}...` });
        const resp = await fetch(`${host}/api/delete`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: model }),
        });
        if (!resp.ok) {
          console.warn(`Failed to delete model ${model}`);
        }
      } catch (e) {
        console.error(`Error deleting model ${model}:`, e);
      }
    }
    
    win?.webContents.send('ollama:reset:status', { status: 'All models deleted' });
    return { success: true };
  } catch (e: any) {
    return { success: false, message: `Failed to delete models: ${e?.message || e}` };
  }
}

async function uninstallOllama(win: BrowserWindow | null): Promise<{ success: boolean; message?: string }> {
  const platform = os.platform();
  
  try {
    win?.webContents.send('ollama:reset:status', { status: 'Uninstalling Ollama...' });
    
    if (platform === 'win32') {
      // Windows: Stop service/processes, run uninstaller if present, then cleanup files
      try {
        // Try to stop the Ollama service and processes
        win?.webContents.send('ollama:reset:status', { status: 'Stopping Ollama service...' });
        try { await runCommand('sc stop Ollama', false); } catch {}
        try { await runCommand('net stop Ollama', false); } catch {}
        try { await runCommand('sc stop ollama', false); } catch {}
        try {
          await runCommand('taskkill /F /T /IM ollama.exe', false);
        } catch {}
        // Give Windows a moment to release file locks
        await new Promise((r) => setTimeout(r, 800));
        
        // Candidate installation directories
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
        const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
        const candidateInstallDirs = [
          path.join(localAppData, 'Programs', 'Ollama'),
          path.join(programFiles, 'Ollama'),
          path.join(programFilesX86, 'Ollama'),
        ];

        // If an uninstaller exists, run it BEFORE deleting directories
        let ranUninstaller = false;
        for (const dir of candidateInstallDirs) {
          const uninstallerCandidates = [
            path.join(dir, 'Uninstall Ollama.exe'),
            path.join(dir, 'unins000.exe'),
          ];
          for (const uninst of uninstallerCandidates) {
            if (fs.existsSync(uninst)) {
              win?.webContents.send('ollama:reset:status', { status: 'Running Ollama uninstaller...' });
              try {
                const res = await runCommand(`"${uninst}" /S`, true);
                ranUninstaller = ranUninstaller || res.success;
                // Wait a bit for the uninstaller to complete and release locks
                await new Promise((r) => setTimeout(r, 1500));
              } catch {}
              break;
            }
          }
          if (ranUninstaller) break;
        }

        // If winget is available, attempt winget uninstall as a fallback
        if (!ranUninstaller) {
          const hasWinget = await checkCommandAvailable('winget');
          if (hasWinget) {
            win?.webContents.send('ollama:reset:status', { status: 'Uninstalling via winget...' });
            try {
              const r = await runCommand('winget uninstall -e --id Ollama.Ollama --silent --accept-package-agreements --accept-source-agreements', true);
              ranUninstaller = ranUninstaller || r.success;
              await new Promise((r) => setTimeout(r, 1200));
            } catch {}
          }
        }

        // Helper to remove a directory with a few retries to overcome EBUSY locks
        const removeDirWithRetry = async (dirPath: string) => {
          if (!fs.existsSync(dirPath)) return;
          let lastErr: any = null;
          for (let i = 0; i < 4; i++) {
            try {
              fs.rmSync(dirPath, { recursive: true, force: true });
              return;
            } catch (e: any) {
              lastErr = e;
              // Try to aggressively kill lingering processes and wait before retry
              try { await runCommand('taskkill /F /T /IM ollama.exe', false); } catch {}
              await new Promise((r) => setTimeout(r, 500 + i * 300));
            }
          }
          // If we reach here, throw the last error
          throw lastErr;
        };
        
        // Remove user data directory first
        const userDataPath = path.join(os.homedir(), '.ollama');
        try { await removeDirWithRetry(userDataPath); } catch {}
        
        // Remove any remaining installation directories
        for (const dir of candidateInstallDirs) {
          try { await removeDirWithRetry(dir); } catch {}
        }
        
        win?.webContents.send('ollama:reset:status', { status: 'Ollama uninstalled' });
        return { success: true };
      } catch (e: any) {
        return { success: false, message: `Uninstall failed: ${e?.message || e}. You may need to uninstall manually from Windows Settings > Apps` };
      }
    } else if (platform === 'darwin') {
      // macOS: Remove via Homebrew or manually
      const hasBrew = await checkCommandAvailable('brew');
      if (hasBrew) {
        try {
          await runCommand('brew uninstall --cask ollama', true);
          win?.webContents.send('ollama:reset:status', { status: 'Ollama uninstalled' });
          return { success: true };
        } catch {}
      }
      // Manual removal
      try {
        await runCommand('rm -rf /Applications/Ollama.app', true);
        await runCommand('rm -rf ~/.ollama', true);
        win?.webContents.send('ollama:reset:status', { status: 'Ollama removed' });
        return { success: true };
      } catch (e: any) {
        return { success: false, message: `Failed to remove Ollama: ${e?.message || e}` };
      }
    } else {
      // Linux: Remove via package manager or systemd
      try {
        await runCommand('systemctl --user stop ollama', false);
        await runCommand('systemctl --user disable ollama', false);
      } catch {}
      
      try {
        await runCommand('sudo rm /usr/local/bin/ollama', true);
        await runCommand('sudo rm /etc/systemd/system/ollama.service', false);
        await runCommand('rm -rf ~/.ollama', true);
        win?.webContents.send('ollama:reset:status', { status: 'Ollama removed' });
        return { success: true };
      } catch (e: any) {
        return { success: false, message: `Failed to remove Ollama: ${e?.message || e}. You may need to run: sudo rm /usr/local/bin/ollama` };
      }
    }
    
    return { success: true };
  } catch (e: any) {
    return { success: false, message: `Uninstall failed: ${e?.message || e}` };
  }
}

async function resetEverything(win: BrowserWindow | null): Promise<{ success: boolean; message?: string }> {
  try {
    // Step 1: Delete all models
    const deleteResult = await deleteAllModels(win);
    if (!deleteResult.success) {
      return deleteResult;
    }
    
    // Step 2: Uninstall Ollama
    const uninstallResult = await uninstallOllama(win);
    if (!uninstallResult.success) {
      return { success: false, message: `Models deleted, but ${uninstallResult.message}` };
    }
    
    // Step 3: Clear app data
    win?.webContents.send('ollama:reset:status', { status: 'Clearing app data...' });
    const userDataPath = app.getPath('userData');
    try {
      // Clear localStorage by reloading with cleared data
      win?.webContents.session.clearStorageData({ storages: ['localstorage'] });
    } catch {}
    
    // Step 4: Reset firstRun flag to trigger onboarding
    updateSettings({ firstRun: true, mode: null });
    
    // Step 5: Notify the renderer to reload
    win?.webContents.send('ollama:reset:status', { status: 'Reset complete!' });
    win?.webContents.send('settings:changed', { firstRun: true, mode: null });
    
    return { success: true, message: 'All data, models, and Ollama have been removed. The app will now reload.' };
  } catch (e: any) {
    return { success: false, message: `Reset failed: ${e?.message || e}` };
  }
}

export function registerOllamaIpc(ipcMain: IpcMain, win: BrowserWindow | null) {
  ipcMain.handle('ollama:listModels', async () => listModels());
  ipcMain.handle('ollama:pull', async (_evt, { id, name }: { id: string; name: string }) => pullModel(win, id, name));
  ipcMain.handle('ollama:chat:start', async (_evt, args) => chatStream(win, args));
  ipcMain.handle('ollama:isInstalled', async () => isOllamaInstalled());
  ipcMain.handle('ollama:ensureServer', async () => ensureOllamaRunning(win));
  ipcMain.handle('ollama:install', async () => installOllama(win));
  ipcMain.handle('ollama:checkUpdate', async () => checkForUpdate());
  ipcMain.handle('ollama:catalog:search', async (_evt, { query, limit }: { query: string; limit?: number }) => searchOllamaCatalog(query, limit));
  ipcMain.handle('ollama:catalog:listTop', async (_evt, { limit }: { limit?: number }) => listTopOllamaCatalog(limit));
  ipcMain.handle('ollama:catalog:getDescription', async (_evt, { name }: { name: string }) => getOllamaModelDescription(name));
  ipcMain.handle('ollama:deleteModel', async (_evt, { name }: { name: string }) => deleteModelByName(name));
  ipcMain.handle('ollama:deleteAllModels', async () => deleteAllModels(win));
  ipcMain.handle('ollama:uninstall', async () => uninstallOllama(win));
  ipcMain.handle('ollama:resetEverything', async () => resetEverything(win));
}

async function deleteModelByName(name: string): Promise<boolean> {
  try {
    const host = getSettings().ollamaHost.replace(/\/$/, '');
    const resp = await fetch(`${host}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function isOllamaInstalled(): Promise<boolean> {
  const platform = os.platform();
  if (platform === 'win32') {
    const exe = findOllamaExeWindows();
    if (exe && fs.existsSync(exe)) {
      return new Promise((resolve) => {
        try {
          const child = spawn(`"${exe}"`, ['--version'], { shell: true });
          child.on('error', () => resolve(false));
          child.on('exit', (code) => resolve(code === 0));
        } catch {
          resolve(false);
        }
      });
    }
  } else if (platform === 'darwin') {
    const exe = findOllamaExeMac();
    if (exe && fs.existsSync(exe)) {
      return new Promise((resolve) => {
        try {
          const child = spawn(`"${exe}"`, ['--version'], { shell: true });
          child.on('error', () => resolve(false));
          child.on('exit', (code) => resolve(code === 0));
        } catch {
          resolve(false);
        }
      });
    }
  } else {
    const exe = findOllamaExeLinux();
    if (exe && fs.existsSync(exe)) {
      return new Promise((resolve) => {
        try {
          const child = spawn(`"${exe}"`, ['--version'], { shell: true });
          child.on('error', () => resolve(false));
          child.on('exit', (code) => resolve(code === 0));
        } catch {
          resolve(false);
        }
      });
    }
  }
  return new Promise((resolve) => {
    try {
      const child = spawn('ollama', ['--version'], { shell: true });
      let checked = false;
      child.on('error', () => {
        if (!checked) resolve(false);
        checked = true;
      });
      child.on('exit', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

async function getOllamaVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const child = spawn('ollama', ['--version'], { shell: true });
      let stdout = '';
      let checked = false;
      child.stdout?.on('data', (d) => (stdout += String(d)));
      child.on('error', () => {
        if (!checked) resolve(null);
        checked = true;
      });
      child.on('exit', (code) => {
        if (!checked) {
          checked = true;
          if (code === 0 && stdout) {
            const match = stdout.match(/ollama\s+version\s+([\d.]+)/i) || stdout.match(/([\d.]+)/);
            resolve(match ? match[1] : null);
          } else {
            resolve(null);
          }
        }
      });
    } catch {
      resolve(null);
    }
  });
}

async function checkForUpdate(): Promise<{ needsUpdate: boolean; currentVersion: string | null; latestVersion: string | null }> {
  const currentVersion = await getOllamaVersion();
  if (!currentVersion) {
    return { needsUpdate: false, currentVersion: null, latestVersion: null };
  }
  
  try {
    // Check latest version from Ollama's GitHub releases
    const response = await fetch('https://api.github.com/repos/ollama/ollama/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!response.ok) {
      return { needsUpdate: false, currentVersion, latestVersion: null };
    }
    const data = await response.json() as any;
    const latestVersion = data.tag_name?.replace(/^v/, '') || null;
    
    if (!latestVersion) {
      return { needsUpdate: false, currentVersion, latestVersion: null };
    }
    
    // Simple version comparison (basic semantic versioning)
    const needsUpdate = compareVersions(currentVersion, latestVersion) < 0;
    return { needsUpdate, currentVersion, latestVersion };
  } catch {
    return { needsUpdate: false, currentVersion, latestVersion: null };
  }
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  const maxLen = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

async function pingOllama(host: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(`${host.replace(/\/$/, '')}/api/tags`, { signal: controller.signal } as RequestInit);
    clearTimeout(t);
    return resp.ok;
  } catch {
    return false;
  }
}

async function ensureOllamaRunning(win: BrowserWindow | null): Promise<boolean> {
  const host = getSettings().ollamaHost || 'http://localhost:11434';
  
  // Check if already running
  if (await pingOllama(host)) {
    win?.webContents.send('ollama:ensure:status', { status: 'Ollama server is running' });
    return true;
  }
  
  win?.webContents.send('ollama:ensure:status', { status: 'Starting Ollama server…' });
  
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      // On Windows, try to start the service
      try {
        await runCommand('net start Ollama', false);
        win?.webContents.send('ollama:ensure:status', { status: 'Started Ollama service' });
      } catch {
        // Service might not exist yet, try running directly
        const exe = findOllamaExeWindows();
        if (exe) {
          const child = spawn(`"${exe}"`, ['serve'], {
            shell: true,
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        } else {
          const child = spawn('ollama', ['serve'], {
            shell: true,
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        }
      }
    } else if (platform === 'darwin') {
      // On macOS, try to open the app
      try {
        await runCommand('open -a Ollama', false);
        win?.webContents.send('ollama:ensure:status', { status: 'Launched Ollama app' });
      } catch {
        // Fallback to direct serve
        const exe = findOllamaExeMac();
        if (exe) {
          const child = spawn(`"${exe}"`, ['serve'], {
            shell: true,
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        } else {
          const child = spawn('ollama', ['serve'], {
            shell: true,
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        }
      }
    } else {
      // Linux: try systemd service first
      try {
        await runCommand('systemctl --user start ollama', false);
        win?.webContents.send('ollama:ensure:status', { status: 'Started Ollama service' });
      } catch {
        // Fallback to direct serve
        const exe = findOllamaExeLinux();
        if (exe) {
          const child = spawn(`"${exe}"`, ['serve'], {
            shell: true,
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        } else {
          const child = spawn('ollama', ['serve'], {
            shell: true,
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        }
      }
    }
  } catch (e) {
    // Last resort: try direct serve
    try {
      const child = spawn('ollama', ['serve'], {
        shell: true,
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } catch {}
  }
  
  // Wait up to 45s for server to start (more time for first launch)
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < 45000) {
    if (await pingOllama(host)) {
      win?.webContents.send('ollama:ensure:status', { status: 'Ollama server is ready!' });
      return true;
    }
    attempt++;
    if (attempt % 3 === 0) {
      win?.webContents.send('ollama:ensure:status', { status: `Waiting for Ollama server… (${Math.floor((Date.now() - start) / 1000)}s)` });
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  
  win?.webContents.send('ollama:ensure:status', { status: 'Server startup taking longer than expected' });
  return false;
}

function findOllamaExeWindows(): string | null {
  try {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const candidates = [
      path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe'),
      path.join(programFiles, 'Ollama', 'ollama.exe'),
      path.join(programFilesX86, 'Ollama', 'ollama.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  return null;
}

function findOllamaExeMac(): string | null {
  try {
    const candidates = [
      '/Applications/Ollama.app/Contents/MacOS/Ollama',
      path.join(os.homedir(), 'Applications', 'Ollama.app', 'Contents', 'MacOS', 'Ollama'),
      '/opt/homebrew/bin/ollama',
      '/usr/local/bin/ollama',
      '/usr/bin/ollama',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  return null;
}

function findOllamaExeLinux(): string | null {
  try {
    const candidates = [
      '/usr/local/bin/ollama',
      '/usr/bin/ollama',
      path.join(os.homedir(), '.local', 'bin', 'ollama'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  return null;
}

async function checkCommandAvailable(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, ['--version'], { shell: true });
      child.on('error', () => resolve(false));
      child.on('exit', (code) => resolve(code === 0));
      // Timeout after 3 seconds
      setTimeout(() => resolve(false), 3000);
    } catch {
      resolve(false);
    }
  });
}

async function installOllama(win: BrowserWindow | null): Promise<{ success: boolean; message?: string }> {
  const platform = os.platform();
  
  try {
    if (platform === 'win32') {
      return await installOllamaWindows(win);
    } else if (platform === 'darwin') {
      return await installOllamaMacOS(win);
    } else {
      return await installOllamaLinux(win);
    }
  } catch (e: any) {
    return { success: false, message: String(e?.message || e) };
  }
}

async function installOllamaWindows(win: BrowserWindow | null): Promise<{ success: boolean; message?: string }> {
  win?.webContents.send('ollama:ensure:status', { status: 'Checking prerequisites…' });
  
  // Try winget first (preferred method)
  const hasWinget = await checkCommandAvailable('winget');
  if (hasWinget) {
    win?.webContents.send('ollama:ensure:status', { status: 'Installing Ollama via winget (this may take a minute)…' });
    const result = await runCommand('winget install -e --id Ollama.Ollama --silent --accept-package-agreements --accept-source-agreements', true);
    if (result.success) {
      win?.webContents.send('ollama:ensure:status', { status: 'Installation complete! Verifying…' });
      // Wait a moment for installation to complete
      await new Promise((r) => setTimeout(r, 2000));
      // Verify installation
      const installed = await isOllamaInstalled();
      if (installed) {
        win?.webContents.send('ollama:ensure:status', { status: 'Ollama installed successfully!' });
        return { success: true };
      }
    }
    win?.webContents.send('ollama:ensure:status', { status: 'winget installation had issues, trying alternative method…' });
  }
  
  // Fallback: Direct download and install
  win?.webContents.send('ollama:ensure:status', { status: 'Downloading Ollama installer…' });
  try {
    const installerUrl = 'https://ollama.com/download/OllamaSetup.exe';
    const tempDir = app.getPath('temp');
    const installerPath = path.join(tempDir, 'OllamaSetup.exe');
    
    // Download the installer
    const response = await fetch(installerUrl);
    if (!response.ok) throw new Error('Failed to download installer');
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(installerPath, Buffer.from(buffer));
    
    win?.webContents.send('ollama:ensure:status', { status: 'Running installer (please wait)…' });
    
    // Run installer silently
    const result = await runCommand(`"${installerPath}" /S`, true);
    
    // Clean up installer
    try {
      fs.unlinkSync(installerPath);
    } catch {}
    
    if (result.success) {
      win?.webContents.send('ollama:ensure:status', { status: 'Installation complete! Verifying…' });
      await new Promise((r) => setTimeout(r, 3000));
      const installed = await isOllamaInstalled();
      if (installed) {
        win?.webContents.send('ollama:ensure:status', { status: 'Ollama installed successfully!' });
        return { success: true };
      }
    }
    
    return { success: false, message: 'Installation completed but Ollama was not found. Please restart the app.' };
  } catch (e: any) {
    return { success: false, message: `Installation failed: ${e?.message || e}. Please install Ollama manually from https://ollama.com` };
  }
}

async function installOllamaMacOS(win: BrowserWindow | null): Promise<{ success: boolean; message?: string }> {
  win?.webContents.send('ollama:ensure:status', { status: 'Checking prerequisites…' });
  
  // Try Homebrew first (preferred method)
  const hasBrew = await checkCommandAvailable('brew');
  if (hasBrew) {
    win?.webContents.send('ollama:ensure:status', { status: 'Installing Ollama via Homebrew (this may take a minute)…' });
    const result = await runCommand('brew install --cask ollama', true);
    if (result.success) {
      win?.webContents.send('ollama:ensure:status', { status: 'Installation complete! Verifying…' });
      await new Promise((r) => setTimeout(r, 2000));
      const installed = await isOllamaInstalled();
      if (installed) {
        win?.webContents.send('ollama:ensure:status', { status: 'Ollama installed successfully!' });
        return { success: true };
      }
    }
    win?.webContents.send('ollama:ensure:status', { status: 'Homebrew installation had issues, trying alternative method…' });
  }
  
  // Fallback: Direct download
  win?.webContents.send('ollama:ensure:status', { status: 'Opening Ollama download page…' });
  try {
    await shell.openExternal('https://ollama.com/download/mac');
    return { success: false, message: 'Please complete the installation from the download page, then restart the app.' };
  } catch (e: any) {
    return { success: false, message: 'Please install Ollama manually from https://ollama.com/download/mac' };
  }
}

async function installOllamaLinux(win: BrowserWindow | null): Promise<{ success: boolean; message?: string }> {
  win?.webContents.send('ollama:ensure:status', { status: 'Installing Ollama via official script…' });
  
  // Use the official install script
  win?.webContents.send('ollama:ensure:status', { status: 'Downloading and installing Ollama (this may take a minute)…' });
  const result = await runCommand('curl -fsSL https://ollama.com/install.sh | sh', true);
  
  if (result.success) {
    win?.webContents.send('ollama:ensure:status', { status: 'Installation complete! Verifying…' });
    await new Promise((r) => setTimeout(r, 2000));
    const installed = await isOllamaInstalled();
    if (installed) {
      win?.webContents.send('ollama:ensure:status', { status: 'Ollama installed successfully!' });
      return { success: true };
    }
  }
  
  return { success: false, message: result.message || 'Installation failed. Please install Ollama manually from https://ollama.com' };
}

function runCommand(cmd: string, waitForCompletion = true, timeoutMs = 300000): Promise<{ success: boolean; message?: string }> {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, { shell: true });
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (d) => (stdout += String(d)));
      child.stderr?.on('data', (d) => (stderr += String(d)));
      
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          resolve({ success: false, message: 'Command timed out' });
        }
      }, timeoutMs);
      
      child.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ 
            success: code === 0, 
            message: code === 0 ? undefined : (stderr || stdout || 'command failed') 
          });
        }
      });
      
      child.on('error', (e) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ success: false, message: String(e) });
        }
      });
    } catch (e: any) {
      resolve({ success: false, message: String(e?.message || e) });
    }
  });
}

// --- Ollama public catalog (best-effort; endpoints may change) ---
async function ollamaFetch(path: string) {
  const url = `https://ollama.com${path}`;
  const resp = await fetch(url, { headers: { 
    'Accept': 'application/json',
    // Use a browser-like UA to avoid upstream blocks
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
  } });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.json();
}

type OllamaCatalogItem = {
  name?: string;
  description?: string;
  size?: number; // bytes, if provided
  downloads?: number;
  likes?: number;
};

function normalizeOllamaItems(items: any[]): Array<{ repo_id: string; description: string; likes: number; downloads: number; worksLocally?: boolean; smallestGgufSize?: number; source: 'ollama' }> {
  const out: Array<{ repo_id: string; description: string; likes: number; downloads: number; worksLocally?: boolean; smallestGgufSize?: number; source: 'ollama' }> = [];
  for (const it of items) {
    const name = String(it?.name || it?.model || '').trim();
    if (!name) continue;
    const desc = String(it?.description || it?.details?.description || '').trim();
    const likes = Number(it?.likes || 0) || 0;
    const downloads = Number(it?.downloads || it?.pull_count || 0) || 0;
    // Parse size more carefully - convert from GB string if needed
    let size: number | undefined = undefined;
    if (it?.size) {
      if (typeof it.size === 'number') {
        size = it.size;
      } else if (typeof it.size === 'string') {
        // Parse size strings like "3.8 GB", "1.2B", etc.
        const sizeStr = it.size.toLowerCase();
        const match = sizeStr.match(/([\d.]+)\s*(gb|mb|b)?/);
        if (match) {
          const num = parseFloat(match[1]);
          const unit = match[2];
          if (unit === 'gb') {
            size = num * 1024 * 1024 * 1024;
          } else if (unit === 'mb') {
            size = num * 1024 * 1024;
          } else if (unit === 'b' && num < 1000) {
            // Model parameter count (e.g., "7B") - estimate size
            size = num * 1024 * 1024 * 1024 * 0.5; // Rough estimate: 0.5GB per billion params
          } else {
            size = num;
          }
        }
      }
    }
    out.push({
      repo_id: name,
      description: desc || 'Ollama model',
      likes,
      downloads,
      worksLocally: true, // Ollama models generally have CPU-friendly variants via quantization
      smallestGgufSize: size,
      source: 'ollama',
    });
  }
  return out;
}

// Try to fetch the full library index from multiple possible sources
async function fetchOllamaLibraryIndex(): Promise<any[]> {
  // 1) Preferred: JSON tags endpoint
  try {
    const tags = await ollamaFetch(`/api/tags`);
    const models = Array.isArray(tags?.models) ? tags.models : [];
    if (models.length > 0) return models;
  } catch {}

  // 2) Alternate JSON endpoint
  try {
    const res = await ollamaFetch(`/api/models`);
    const models = Array.isArray((res as any)?.models) ? (res as any).models : (Array.isArray(res) ? res : []);
    if (models.length > 0) return models;
  } catch {}

  // 3) Fallback: scrape the library HTML for embedded Next.js data
  try {
    const url = `https://ollama.com/library`;
    const resp = await fetch(url, { headers: { 
      'Accept': 'text/html',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Referer': 'https://ollama.com/'
    } });
    if (resp.ok) {
      const html = await resp.text();
      // Next.js __NEXT_DATA__
      const nextDataMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
      if (nextDataMatch && nextDataMatch[1]) {
        try {
          const json = JSON.parse(nextDataMatch[1]);
          const found = findModelsArrayInObject(json);
          if (Array.isArray(found) && found.length > 0) {
            return found;
          }
        } catch {}
      }
    }
  } catch {}

  return [];
}

function findModelsArrayInObject(obj: any): any[] | null {
  try {
    if (!obj || typeof obj !== 'object') return null;
    // If obj looks like a model entry array
    if (Array.isArray(obj) && obj.length > 0) {
      // Consider it a models array if items have a 'name' or 'model' field
      const looksLikeModels = obj.every((it) => it && typeof it === 'object' && ('name' in it || 'model' in it));
      if (looksLikeModels) return obj;
    }
    // Recurse through keys
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      const sub = findModelsArrayInObject(val);
      if (sub) return sub;
    }
  } catch {}
  return null;
}

async function searchOllamaCatalog(query: string, limit = 500) {
  const q = (query || '').trim();

  // Prefer comprehensive index from /api/tags and filter client-side
  try {
    const models = await fetchOllamaLibraryIndex();
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const tokenNorms = tokens.map(t => normalize(t));
    const tokenVariants = tokenNorms.map(t => [t, t.replace(/\d+/g, '')].filter(Boolean));
    const matched = tokens.length > 0
      ? models.filter((m: any) => {
          const nameRaw = String(m?.name || m?.model || '');
          const descRaw = String(m?.description || m?.details?.description || '');
          const base = nameRaw.split(':')[0];
          const haystacks = [
            nameRaw, base, nameRaw.replace(/[:._-]/g, ' '), descRaw,
          ];
          const normalizedHay = haystacks.map(s => normalize(s));
          // Every token (or its digit-less variant) must appear in at least one normalized haystack
          return tokenVariants.every(([tn, tnodigits]) => 
            normalizedHay.some(h => h.includes(tn)) || (!!tnodigits && normalizedHay.some(h => h.includes(tnodigits!)))
          );
        })
      : models;
    if (matched.length > 0) {
      return normalizeOllamaItems(matched).slice(0, limit);
    }
  } catch (e) {
    console.error('Ollama tags fetch failed:', e);
  }

  // Fallback: server-side search endpoint (may be partial/top)
  try {
    const res = await ollamaFetch(`/api/search${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    const items = Array.isArray(res?.models) ? res.models : (Array.isArray(res) ? res : []);
    if (items.length > 0) {
      return normalizeOllamaItems(items).slice(0, limit);
    }
  } catch (e) {
    console.error('Ollama search failed:', e);
  }

  // Last resort: in-app defaults (quick fallback)
  const defaults = getDefaultOllamaModels();
  if (!q) return defaults;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const token = normalize(q);
  const tokenNoDigits = token.replace(/\d+/g, '');
  return defaults.filter(m => {
    const repo = normalize(m.repo_id);
    const desc = normalize(m.description);
    return repo.includes(token) || desc.includes(token) || 
           (!!tokenNoDigits && (repo.includes(tokenNoDigits) || desc.includes(tokenNoDigits)));
  });
}

async function listTopOllamaCatalog(limit = 500) {
  // Try comprehensive index first
  try {
    const items = await fetchOllamaLibraryIndex();
    if (items.length > 0) {
      return normalizeOllamaItems(items).slice(0, limit);
    }
  } catch (e) {
    console.error('Ollama catalog fetch failed:', e);
  }

  // Fallback: try the partial search endpoint
  try {
    const res = await ollamaFetch(`/api/search`);
    const items = Array.isArray(res?.models) ? res.models : (Array.isArray(res) ? res : []);
    if (items.length > 0) {
      return normalizeOllamaItems(items).slice(0, limit);
    }
  } catch (e) {
    console.error('Ollama catalog fetch failed:', e);
  }

  // Last resort: return ALL hardcoded models
  return getDefaultOllamaModels();
}

async function getOllamaModelDescription(name: string): Promise<{ description: string | null }> {
  // Normalize to base model id without tag (e.g., "llama3:8b" -> "llama3")
  const base = String(name || '').split(':')[0].trim();
  if (!base) return { description: null };

  // 1) Try the public search endpoint for a structured description
  try {
    const res = await ollamaFetch(`/api/search?q=${encodeURIComponent(base)}`);
    const items = Array.isArray(res?.models) ? res.models : (Array.isArray(res) ? res : []);
    if (items.length > 0) {
      // Prefer exact match on name/model, else first item
      const lower = base.toLowerCase();
      const exact = items.find((it: any) => String(it?.name || it?.model || '').toLowerCase() === lower);
      const best = exact || items.find((it: any) => String(it?.name || it?.model || '').toLowerCase().startsWith(lower)) || items[0];
      const desc = String(best?.description || '').trim();
      if (desc) return { description: desc };
    }
  } catch (e) {
    // continue to fallback
  }

  // 2) Fallback: Fetch the library HTML page and parse meta/JSON-LD description
  try {
    const url = `https://ollama.com/library/${encodeURIComponent(base)}`;
    const resp = await fetch(url, { headers: { 'Accept': 'text/html' } });
    if (resp.ok) {
      const html = await resp.text();
      // Try meta description
      const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
      if (metaMatch && metaMatch[1]) {
        return { description: metaMatch[1].trim() };
      }
      // Try JSON-LD
      const ldMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (ldMatch && ldMatch[1]) {
        try {
          const json = JSON.parse(ldMatch[1]);
          if (json && typeof json === 'object') {
            const desc = (json as any).description;
            if (desc && typeof desc === 'string') {
              return { description: desc.trim() };
            }
          }
        } catch {}
      }
    }
  } catch {}

  return { description: null };
}

function getDefaultOllamaModels(): Array<{ repo_id: string; description: string; likes: number; downloads: number; worksLocally: boolean; smallestGgufSize?: number; source: 'ollama' }> {
  // Complete Ollama library catalog - ALL available models
  return [
    // Llama 3.3 Series
    { repo_id: 'llama3.3:latest', description: 'Llama 3.3 70B - Latest Meta flagship model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 43 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3.3:70b', description: 'Llama 3.3 70B - Powerful 70B parameter model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 43 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Llama 3.2 Series
    { repo_id: 'llama3.2:latest', description: 'Llama 3.2 - Latest Meta model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 2 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3.2:1b', description: 'Llama 3.2 1B - Tiny efficient model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3.2:3b', description: 'Llama 3.2 3B - Balanced small model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 2 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3.2-vision:11b', description: 'Llama 3.2 Vision 11B - Multimodal model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3.2-vision:90b', description: 'Llama 3.2 Vision 90B - Advanced vision model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 55 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Llama 3.1 Series
    { repo_id: 'llama3.1:latest', description: 'Llama 3.1 - Versatile model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.7 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3.1:8b', description: 'Llama 3.1 8B - High quality 8B model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.7 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3.1:70b', description: 'Llama 3.1 70B - Premium large model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 40 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3.1:405b', description: 'Llama 3.1 405B - Massive flagship model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 231 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Llama 3 Base Series
    { repo_id: 'llama3:latest', description: 'Llama 3 - Original Meta LLM', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.7 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3:8b', description: 'Llama 3 8B - Efficient 8B model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.7 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3:70b', description: 'Llama 3 70B - Large capable model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 40 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3-gradient:8b', description: 'Llama 3 Gradient 8B - Extended context', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.7 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama3-gradient:70b', description: 'Llama 3 Gradient 70B - Long context large model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 40 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Llama 2 Series
    { repo_id: 'llama2:latest', description: 'Llama 2 - Previous gen Meta model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama2:7b', description: 'Llama 2 7B - Proven 7B model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama2:13b', description: 'Llama 2 13B - Mid-size model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama2:70b', description: 'Llama 2 70B - Large model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 38 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama2-uncensored:latest', description: 'Llama 2 Uncensored - No content filtering', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llama2-uncensored:7b', description: 'Llama 2 Uncensored 7B', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Mistral Series
    { repo_id: 'mistral:latest', description: 'Mistral 7B - Excellent performance', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'mistral:7b', description: 'Mistral 7B - Fast and capable', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'mistral-nemo:latest', description: 'Mistral Nemo 12B - Efficient mid-size', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'mistral-small:latest', description: 'Mistral Small 22B - Balanced model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 13 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'mistral-large:latest', description: 'Mistral Large - Flagship model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 123 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'mistral-openorca:latest', description: 'Mistral OpenOrca - ORCA dataset tuned', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Mixtral (MoE) Series
    { repo_id: 'mixtral:latest', description: 'Mixtral 8x7B - Mixture of experts', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 26 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'mixtral:8x7b', description: 'Mixtral 8x7B - 8 expert MoE model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 26 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'mixtral:8x22b', description: 'Mixtral 8x22B - Large MoE model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 80 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'dolphin-mixtral:latest', description: 'Dolphin Mixtral 8x7B - Uncensored MoE', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 26 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'dolphin-mixtral:8x7b', description: 'Dolphin Mixtral 8x7B - Fine-tuned MoE', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 26 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'dolphin-mixtral:8x22b', description: 'Dolphin Mixtral 8x22B - Large uncensored MoE', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 80 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Phi Series (Microsoft)
    { repo_id: 'phi3:latest', description: 'Phi-3 - Microsoft small LM', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 2.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'phi3:mini', description: 'Phi-3 Mini 3.8B - Efficient model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 2.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'phi3:medium', description: 'Phi-3 Medium 14B - Mid-size model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'phi3.5:latest', description: 'Phi-3.5 - Enhanced Microsoft model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 2.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'phi4:latest', description: 'Phi-4 - Latest Microsoft SLM', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 8.5 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Gemma Series (Google)
    { repo_id: 'gemma:latest', description: 'Gemma - Google open model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.6 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'gemma:2b', description: 'Gemma 2B - Tiny Google model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.6 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'gemma:7b', description: 'Gemma 7B - Capable Google model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'gemma2:latest', description: 'Gemma 2 - Improved Google model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.6 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'gemma2:2b', description: 'Gemma 2 2B - Enhanced tiny model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.6 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'gemma2:9b', description: 'Gemma 2 9B - Mid-size Google model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 5.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'gemma2:27b', description: 'Gemma 2 27B - Large Google model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 16 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Qwen Series (Alibaba)
    { repo_id: 'qwen:latest', description: 'Qwen - Alibaba multilingual model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 2.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen:0.5b', description: 'Qwen 0.5B - Ultra tiny model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen:1.8b', description: 'Qwen 1.8B - Compact model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen:4b', description: 'Qwen 4B - Balanced small model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 2.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen:7b', description: 'Qwen 7B - Versatile 7B model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen:14b', description: 'Qwen 14B - Mid-size model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 8.2 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen:32b', description: 'Qwen 32B - Large multilingual', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 18 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen:72b', description: 'Qwen 72B - Flagship model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 41 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen:110b', description: 'Qwen 110B - Massive model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 63 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2:latest', description: 'Qwen 2 - Enhanced Alibaba model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2:0.5b', description: 'Qwen 2 0.5B - Ultralight model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2:1.5b', description: 'Qwen 2 1.5B - Small efficient', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2:7b', description: 'Qwen 2 7B - Improved 7B', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2:72b', description: 'Qwen 2 72B - Large enhanced', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 41 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5:latest', description: 'Qwen 2.5 - Latest Alibaba model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5:0.5b', description: 'Qwen 2.5 0.5B - Tiny but capable', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5:1.5b', description: 'Qwen 2.5 1.5B - Small and fast', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5:3b', description: 'Qwen 2.5 3B - Balanced efficiency', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5:7b', description: 'Qwen 2.5 7B - Strong performance', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5:14b', description: 'Qwen 2.5 14B - Enhanced mid-size', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 8.2 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5:32b', description: 'Qwen 2.5 32B - Large model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 18 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5:72b', description: 'Qwen 2.5 72B - Flagship', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 41 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5-coder:latest', description: 'Qwen 2.5 Coder - Code specialist', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5-coder:1.5b', description: 'Qwen 2.5 Coder 1.5B - Compact coding', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5-coder:7b', description: 'Qwen 2.5 Coder 7B - Coding model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'qwen2.5-coder:32b', description: 'Qwen 2.5 Coder 32B - Advanced coding', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 18 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Code Llama Series
    { repo_id: 'codellama:latest', description: 'Code Llama - Meta code model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'codellama:7b', description: 'Code Llama 7B - Coding specialist', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'codellama:13b', description: 'Code Llama 13B - Advanced coding', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'codellama:34b', description: 'Code Llama 34B - Large code model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 19 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'codellama:70b', description: 'Code Llama 70B - Flagship code model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 38 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // DeepSeek Series
    { repo_id: 'deepseek-coder:latest', description: 'DeepSeek Coder - Code generation', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-coder:1.3b', description: 'DeepSeek Coder 1.3B - Tiny coder', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-coder:6.7b', description: 'DeepSeek Coder 6.7B - Efficient coder', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-coder:33b', description: 'DeepSeek Coder 33B - Large coder', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 18.5 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-coder-v2:latest', description: 'DeepSeek Coder V2 - Enhanced', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 8.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-coder-v2:16b', description: 'DeepSeek Coder V2 16B - Advanced coding', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 8.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-coder-v2:236b', description: 'DeepSeek Coder V2 236B - Massive coder', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 133 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-v2:latest', description: 'DeepSeek V2 - General purpose', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 133 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-v2.5:latest', description: 'DeepSeek V2.5 - Latest version', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 133 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-r1:latest', description: 'DeepSeek R1 - Reasoning model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-r1:1.5b', description: 'DeepSeek R1 1.5B - Compact reasoning', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-r1:7b', description: 'DeepSeek R1 7B - Reasoning specialist', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-r1:8b', description: 'DeepSeek R1 8B - Enhanced reasoning', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.7 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-r1:14b', description: 'DeepSeek R1 14B - Advanced reasoning', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 8.2 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-r1:32b', description: 'DeepSeek R1 32B - Large reasoning', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 18 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-r1:70b', description: 'DeepSeek R1 70B - Flagship reasoning', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 40 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'deepseek-r1:671b', description: 'DeepSeek R1 671B - Massive reasoning model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 382 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Vision Models
    { repo_id: 'llava:latest', description: 'LLaVA - Vision + language', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.5 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llava:7b', description: 'LLaVA 7B - Multimodal 7B', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.5 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llava:13b', description: 'LLaVA 13B - Advanced vision model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.6 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llava:34b', description: 'LLaVA 34B - Large vision model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 19 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llava-phi3:latest', description: 'LLaVA Phi3 - Efficient vision', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 2.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'llava-llama3:latest', description: 'LLaVA Llama3 - Vision with Llama', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 5.5 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'bakllava:latest', description: 'BakLLaVA - Vision-language model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.5 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'moondream:latest', description: 'Moondream - Tiny vision model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.7 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'minicpm-v:latest', description: 'MiniCPM-V - Compact multimodal', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 2.8 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Chat Models
    { repo_id: 'vicuna:latest', description: 'Vicuna - Chat optimized', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'vicuna:7b', description: 'Vicuna 7B - Fine-tuned chat', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'vicuna:13b', description: 'Vicuna 13B - Enhanced chat', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'vicuna:33b', description: 'Vicuna 33B - Large chat model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 18.5 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'openchat:latest', description: 'OpenChat - Open source chat', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'openchat:7b', description: 'OpenChat 7B - Efficient chat', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'neural-chat:latest', description: 'Neural Chat - Conversational', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'neural-chat:7b', description: 'Neural Chat 7B - Intel optimized', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'starling-lm:latest', description: 'Starling LM - High quality chat', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'starling-lm:7b', description: 'Starling LM 7B - RLAIF trained', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'orca-mini:latest', description: 'Orca Mini - Compact assistant', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'orca-mini:3b', description: 'Orca Mini 3B - Small helper', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'orca-mini:7b', description: 'Orca Mini 7B - Capable assistant', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'orca-mini:13b', description: 'Orca Mini 13B - Advanced assistant', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'orca-mini:70b', description: 'Orca Mini 70B - Large assistant', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 38 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Specialized Models
    { repo_id: 'nous-hermes:latest', description: 'Nous Hermes - Multi-purpose', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'nous-hermes:7b', description: 'Nous Hermes 7B - Versatile model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'nous-hermes:13b', description: 'Nous Hermes 13B - Enhanced', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'nous-hermes2:latest', description: 'Nous Hermes 2 - Improved', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'nous-hermes2-mixtral:latest', description: 'Nous Hermes 2 Mixtral - MoE variant', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 26 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'wizard-vicuna-uncensored:latest', description: 'Wizard Vicuna Uncensored', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'wizard-vicuna-uncensored:7b', description: 'Wizard Vicuna Uncensored 7B', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'wizard-vicuna-uncensored:13b', description: 'Wizard Vicuna Uncensored 13B', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'wizard-vicuna-uncensored:30b', description: 'Wizard Vicuna Uncensored 30B', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 17 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Tiny Models
    { repo_id: 'tinyllama:latest', description: 'TinyLlama 1.1B - Ultra compact', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.6 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'tinydolphin:latest', description: 'TinyDolphin 1.1B - Tiny uncensored', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.6 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'stablelm2:latest', description: 'StableLM 2 - Stability AI', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'stablelm2:1.6b', description: 'StableLM 2 1.6B - Compact Stability', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 0.9 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'stablelm-zephyr:latest', description: 'StableLM Zephyr - Chat variant', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.6 * 1024 * 1024 * 1024, source: 'ollama' },
    
    // Other Popular Models
    { repo_id: 'yi:latest', description: 'Yi - 01.AI multilingual', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.5 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'yi:6b', description: 'Yi 6B - Chinese-English bilingual', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.5 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'yi:9b', description: 'Yi 9B - Enhanced bilingual', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 5.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'yi:34b', description: 'Yi 34B - Large multilingual', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 19 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'falcon:latest', description: 'Falcon - TII model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'falcon:7b', description: 'Falcon 7B - UAE model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'falcon:40b', description: 'Falcon 40B - Large TII model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 22 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'falcon:180b', description: 'Falcon 180B - Massive model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 100 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'solar:latest', description: 'Solar - Upstage model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 6.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'solar:10.7b', description: 'Solar 10.7B - High performance', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 6.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'command-r:latest', description: 'Command R - Cohere model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 20 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'command-r:35b', description: 'Command R 35B - RAG optimized', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 20 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'command-r-plus:latest', description: 'Command R+ - Enhanced Cohere', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 60 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'aya:latest', description: 'Aya - Multilingual by Cohere', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'aya:8b', description: 'Aya 8B - 101 languages', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'aya:35b', description: 'Aya 35B - Large multilingual', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 20 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'wizardlm2:latest', description: 'WizardLM 2 - Microsoft tuned', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'wizardlm2:7b', description: 'WizardLM 2 7B - Instruction tuned', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'wizardcoder:latest', description: 'WizardCoder - Code specialist', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'wizardcoder:7b', description: 'WizardCoder 7B - Coding model', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'wizardcoder:13b', description: 'WizardCoder 13B - Advanced coder', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'wizardcoder:33b', description: 'WizardCoder 33B - Large coder', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 18.5 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'zephyr:latest', description: 'Zephyr - HuggingFace chat', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'zephyr:7b', description: 'Zephyr 7B - Direct preference', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'notus:latest', description: 'Notus - Fine-tuned Zephyr', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'notus:7b', description: 'Notus 7B - DPO optimized', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'samantha-mistral:latest', description: 'Samantha Mistral - Companion AI', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'samantha-mistral:7b', description: 'Samantha Mistral 7B - Empathetic', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'sqlcoder:latest', description: 'SQLCoder - SQL specialist', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.2 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'sqlcoder:7b', description: 'SQLCoder 7B - Database queries', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.2 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'sqlcoder:15b', description: 'SQLCoder 15B - Advanced SQL', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 8.4 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'dolphin-llama3:latest', description: 'Dolphin Llama 3 - Uncensored', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.7 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'dolphin-llama3:8b', description: 'Dolphin Llama 3 8B - Uncensored', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.7 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'dolphin-llama3:70b', description: 'Dolphin Llama 3 70B - Large uncensored', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 40 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'dolphin-mistral:latest', description: 'Dolphin Mistral - Uncensored', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'dolphin-mistral:7b', description: 'Dolphin Mistral 7B - No filters', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'dolphin-phi:latest', description: 'Dolphin Phi - Uncensored Phi', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.6 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'dolphin-phi:2.7b', description: 'Dolphin Phi 2.7B - Tiny uncensored', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 1.6 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'nous-capybara:latest', description: 'Nous Capybara - Long context', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'nous-capybara:7b', description: 'Nous Capybara 7B - 8k context', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'nous-capybara:34b', description: 'Nous Capybara 34B - Extended context', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 19 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'everythinglm:latest', description: 'EverythingLM - Uncensored mix', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'everythinglm:13b', description: 'EverythingLM 13B - No restrictions', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.3 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'medllama2:latest', description: 'MedLLama 2 - Medical specialist', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'medllama2:7b', description: 'MedLLama 2 7B - Healthcare', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'meditron:latest', description: 'Meditron - Medical reasoning', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'meditron:7b', description: 'Meditron 7B - Clinical tasks', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 3.8 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'meditron:70b', description: 'Meditron 70B - Advanced medical', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 38 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'openhermes:latest', description: 'OpenHermes - Teknium tuned', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'openhermes:7b', description: 'OpenHermes 7B - Quality dataset', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 4.1 * 1024 * 1024 * 1024, source: 'ollama' },
    { repo_id: 'openhermes:13b', description: 'OpenHermes 13B - Enhanced', likes: 0, downloads: 0, worksLocally: true, smallestGgufSize: 7.3 * 1024 * 1024 * 1024, source: 'ollama' },
  ];
}



