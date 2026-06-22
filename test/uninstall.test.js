import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { configDir } from '../src/config.js';
import { uninstallSetup } from '../src/uninstall.js';

test('force uninstall removes config and calls npm uninstall', async () => {
  const workspace = await prepareHome();
  await fs.mkdir(configDir(), { recursive: true });
  await fs.writeFile(path.join(configDir(), 'config.json'), '{}');
  await fs.writeFile(path.join(configDir(), 'update-check.json'), '{}');
  const calls = [];

  const result = await uninstallSetup({
    force: true,
    packageName: '@ciellllllllll/setup',
    npmUninstall: (packageName) => {
      calls.push(packageName);
      return { status: 0 };
    }
  });

  assert.equal(result.configRemoved, true);
  assert.equal(await exists(configDir()), false);
  assert.deepEqual(calls, ['@ciellllllllll/setup']);
  assert.ok(workspace);
});

test('keep-config leaves config directory in place', async () => {
  await prepareHome();
  await fs.mkdir(configDir(), { recursive: true });
  await fs.writeFile(path.join(configDir(), 'update-check.json'), '{}');
  const calls = [];

  await uninstallSetup({
    force: true,
    keepConfig: true,
    packageName: '@ciellllllllll/setup',
    npmUninstall: (packageName) => {
      calls.push(packageName);
      return { status: 0 };
    }
  });

  assert.equal(await exists(configDir()), true);
  assert.equal(await exists(path.join(configDir(), 'update-check.json')), true);
  assert.deepEqual(calls, ['@ciellllllllll/setup']);
});

test('normal uninstall cancels when confirmation is not accepted', async () => {
  await prepareHome();
  await fs.mkdir(configDir(), { recursive: true });
  let called = false;

  const result = await uninstallSetup({
    packageName: '@ciellllllllll/setup',
    confirm: async () => false,
    npmUninstall: () => {
      called = true;
      return { status: 0 };
    }
  });

  assert.equal(result.canceled, true);
  assert.equal(called, false);
  assert.equal(await exists(configDir()), true);
});

async function prepareHome() {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  process.env.USERPROFILE = path.join(workspace, 'home');
  return workspace;
}

async function exists(target) {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}
