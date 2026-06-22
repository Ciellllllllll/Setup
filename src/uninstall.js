import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';
import { configDir } from './config.js';

export async function uninstallSetup(options = {}) {
  const packageName = options.packageName || await readPackageName();
  const dir = configDir();
  const force = Boolean(options.force);
  const keepConfig = Boolean(options.keepConfig);
  const npmUninstall = options.npmUninstall || defaultNpmUninstall;
  const confirm = options.confirm || promptConfirm;

  if (!force) {
    const accepted = await confirm(dir);
    if (!accepted) {
      console.log('Uninstall canceled.');
      return { canceled: true };
    }
  }

  let configRemoved = false;
  if (keepConfig) {
    console.log(`Kept config:\n  ${dir}`);
  } else {
    if (await exists(dir)) {
      await fs.rm(dir, { recursive: true, force: true });
      configRemoved = true;
    } else {
      console.log('Config directory was not found. Skipped config removal.');
    }
  }

  const result = npmUninstall(packageName);
  if ((result?.status ?? 0) !== 0) {
    console.log('Setup config was removed, but npm uninstall failed.\n');
    console.log('Run manually:');
    console.log(`  npm uninstall -g ${packageName}`);
    return { configRemoved, npmRemoved: false };
  }

  console.log('Setup was uninstalled.\n');
  console.log(keepConfig ? 'Kept config:' : 'Removed:');
  console.log(`  ${dir}\n`);
  console.log('Package:');
  console.log(`  ${packageName}`);
  return { configRemoved, npmRemoved: true };
}

async function exists(dir) {
  try {
    await fs.stat(dir);
    return true;
  } catch {
    return false;
  }
}

async function promptConfirm(dir) {
  console.log('This will uninstall Setup and remove saved Setup configuration.\n');
  console.log('Remove:');
  console.log(`  ${dir}\n`);
  console.log('It will NOT remove:');
  console.log('  - GSLIB itself');
  console.log('  - generated game projects');
  console.log('  - Visual Studio');
  console.log('  - Node.js\n');
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question('Continue? [y/N] ');
  rl.close();
  return ['y', 'yes'].includes(answer.trim().toLowerCase());
}

function defaultNpmUninstall(packageName) {
  return spawnSync('npm', ['uninstall', '-g', packageName], { stdio: 'inherit', shell: process.platform === 'win32' });
}

async function readPackageName() {
  const packageJsonPath = path.resolve(fileURLToPath(new URL('../package.json', import.meta.url)));
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  return packageJson.name;
}
