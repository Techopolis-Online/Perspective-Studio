'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync, lstatSync } = require('node:fs');

exports.default = async function beforeSign(context) {
  const filePath = context.path;
  try {
    if (existsSync(filePath)) {
      // Clear extended attributes on the target being signed
      execFileSync('xattr', ['-cr', filePath], { stdio: 'ignore' });
      // If it's a .app or framework, clear on its Contents too
      try {
        if (lstatSync(filePath).isDirectory()) {
          execFileSync('xattr', ['-cr', `${filePath}/Contents`], { stdio: 'ignore' });
        }
      } catch {}
      console.log('[beforeSign] Cleared xattrs on', filePath);
    }
  } catch (e) {
    console.warn('[beforeSign] xattr failed on', filePath, e?.message || e);
  }
};
