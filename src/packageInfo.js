import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function readPackageInfo() {
  const packageJsonPath = path.resolve(fileURLToPath(new URL('../package.json', import.meta.url)));
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  return {
    packageName: packageJson.name,
    currentVersion: packageJson.version
  };
}
