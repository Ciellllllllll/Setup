import fs from 'node:fs/promises';
import path from 'node:path';
import { configDir } from './config.js';

export function updateCheckPath() {
  return path.join(configDir(), 'update-check.json');
}

export async function readUpdateCheckState() {
  try {
    return JSON.parse(await fs.readFile(updateCheckPath(), 'utf8'));
  } catch {
    return null;
  }
}

export async function writeUpdateCheckState(state) {
  await fs.mkdir(configDir(), { recursive: true });
  const target = updateCheckPath();
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fs.rename(temp, target);
}
