import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { configDir } from '../src/config.js';
import { readUpdateCheckState, updateCheckPath, writeUpdateCheckState } from '../src/updateCheckState.js';

test('reads corrupted update-check.json as missing state', async () => {
  await prepareHome();
  await fs.mkdir(configDir(), { recursive: true });
  await fs.writeFile(updateCheckPath(), '{ broken json', 'utf8');

  assert.equal(await readUpdateCheckState(), null);
});

test('writes formatted update-check.json', async () => {
  await prepareHome();

  await writeUpdateCheckState({
    version: 1,
    packageName: '@ciellllllllll/setup',
    currentVersion: '0.1.0',
    latestVersion: '0.2.0',
    lastCheckedAt: '2026-06-22T00:00:00.000Z',
    lastResult: 'update-available'
  });

  const saved = JSON.parse(await fs.readFile(updateCheckPath(), 'utf8'));
  assert.equal(saved.lastResult, 'update-available');
});

async function prepareHome() {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  process.env.USERPROFILE = path.join(workspace, 'home');
}
