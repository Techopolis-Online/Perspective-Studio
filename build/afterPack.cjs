'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') return;
  const appName = packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  if (!existsSync(appPath)) return;
  try {
    // Remove extended attributes that break codesign (Finder info, resource forks)
    execFileSync('xattr', ['-cr', appPath], { stdio: 'ignore' });
    console.log('[afterPack] Cleared extended attributes on', appPath);
  } catch (e) {
    console.warn('[afterPack] xattr failed:', e?.message || e);
  }
};
