import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { configPath } from '../src/config.js';
import { findAndSaveGslib, validateGslibRoot } from '../src/gslibFinder.js';
import { createFakeGslib, createFakeVisualStudio } from '../test-support/helpers.js';

test('validates and saves manually specified fake GSLIB path', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  process.env.USERPROFILE = path.join(workspace, 'home');
  const fake = await createFakeGslib(workspace);
  const vs = await createFakeVisualStudio(workspace);

  const config = await findAndSaveGslib(fake, { candidateRoots: [vs.root], skipVswhere: true });
  const saved = JSON.parse(await fs.readFile(configPath(), 'utf8'));

  assert.equal(config.includeDir, path.join(fake, 'include'));
  assert.equal(config.libDir, path.join(fake, 'lib'));
  assert.equal(config.binDir, path.join(fake, 'bin'));
  assert.equal(saved.version, 2);
  assert.equal(saved.activeProfile, 'default');
  assert.ok(saved.profiles.default);
  assert.equal(saved.profiles.default.includeDir, path.join(fake, 'include'));
  assert.equal(saved.profiles.default.libDir, path.join(fake, 'lib'));
  assert.deepEqual(saved.profiles.default.libraries, ['gslib.lib']);
  assert.equal(saved.profiles.default.platform, 'Win32');
  assert.equal(saved.profiles.default.toolset, 'v143');
  assert.equal(saved.profiles.default.visualStudio.displayName, 'Visual Studio 2022 Community');
  assert.deepEqual(saved.profiles.default.visualStudio.detectedToolsets, ['v143', 'v142']);
  assert.match(saved.profiles.default.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('saves manually specified fake GSLIB path as named profile', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  process.env.USERPROFILE = path.join(workspace, 'home');
  const fake = await createFakeGslib(workspace);
  const vs = await createFakeVisualStudio(workspace);

  await findAndSaveGslib(fake, { profileName: 'gslib2021', candidateRoots: [vs.root], skipVswhere: true });
  const saved = JSON.parse(await fs.readFile(configPath(), 'utf8'));

  assert.equal(saved.activeProfile, 'gslib2021');
  assert.ok(saved.profiles.gslib2021);
});

test('accepts valid GSLIB without bin directory', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  const fake = path.join(workspace, 'fake-gslib');
  await fs.mkdir(path.join(fake, 'include'), { recursive: true });
  await fs.mkdir(path.join(fake, 'lib'), { recursive: true });
  await fs.writeFile(path.join(fake, 'include', 'GSgame.h'), '');
  await fs.writeFile(path.join(fake, 'lib', 'gslib.lib'), '');

  const config = await validateGslibRoot(fake);

  assert.equal(config.binDir, null);
});
