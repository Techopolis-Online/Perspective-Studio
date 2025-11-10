'use strict';

const { notarize } = require('@electron/notarize');
const { execSync } = require('node:child_process');
const { existsSync } = require('node:fs');

function isSigned(appPath) {
  try {
    // codesign -dv writes to stderr; capture both
    const out = execSync(`codesign -dv --verbose=4 "${appPath}" 2>&1`, { stdio: 'pipe' }).toString();
    return /Authority=Developer ID Application:/m.test(out);
  } catch (e) {
    return false;
  }
}

exports.default = async function notarizeHook(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  if (!existsSync(appPath)) {
    console.log('[notarize] Skipping: app path not found', appPath);
    return;
  }

  // Skip if not signed with a proper Developer ID identity
  if (!isSigned(appPath)) {
    console.log('[notarize] Skipping notarization: app is not signed with Developer ID');
    return;
  }

  const hasAppleIdCreds = !!(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD);
  const hasApiKeyCreds = !!(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER);

  if (!hasAppleIdCreds && !hasApiKeyCreds) {
    console.log('[notarize] Skipping notarization: missing Apple credentials');
    return;
  }

  const opts = {
    appBundleId: packager.appInfo.appId,
    appPath,
  };

  if (hasAppleIdCreds) {
    opts.appleId = process.env.APPLE_ID;
    opts.appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
    if (process.env.APPLE_TEAM_ID) opts.teamId = process.env.APPLE_TEAM_ID;
  } else {
    opts.appleApiKey = process.env.APPLE_API_KEY; // path to .p8 file
    opts.appleApiKeyId = process.env.APPLE_API_KEY_ID;
    opts.appleApiIssuer = process.env.APPLE_API_ISSUER;
  }

  console.log('[notarize] Submitting app for notarization...');
  await notarize(opts);
  console.log('[notarize] Notarization complete.');
};
