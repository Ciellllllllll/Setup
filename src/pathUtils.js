import path from 'node:path';

export function userHome() {
  return process.env.USERPROFILE || process.env.HOME || process.cwd();
}

export function toWindowsPath(value) {
  return value.split(path.sep).join('\\');
}

export function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function assertSafePathName(rawName) {
  if (!rawName || !/^[A-Za-z0-9_ -]+$/.test(rawName) || rawName.includes('..')) {
    throw new Error(`Invalid project name: ${rawName || '(empty)'}`);
  }
}

export function assertSafeProfileName(rawName) {
  if (!rawName || !/^[A-Za-z0-9_-]+$/.test(rawName) || rawName.includes('..')) {
    throw new Error(`Invalid profile name: ${rawName || '(empty)'}`);
  }
}
