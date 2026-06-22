import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { configPath, writeConfig } from '../src/config.js';
import { doctor, listProfiles, removeProfile, showConfig, useProfile } from '../src/configCommands.js';
import { createFakeGslibNamed, createFakeVisualStudio, makeConfig, makeProfile } from '../test-support/helpers.js';

test('lists profiles with active marker and status', async () => {
  const workspace = await prepareHome();
  await createFakeVisualStudio(workspace);
  const fakeDefault = await createFakeGslibNamed(workspace, 'default-gslib');
  const fakeOther = await createFakeGslibNamed(workspace, 'gslib2021');
  await writeConfig(makeConfig({
    default: makeProfile(fakeDefault),
    gslib2021: makeProfile(fakeOther)
  }, 'gslib2021'));

  const output = await captureConsole(() => listProfiles());

  assert.match(output, /\* gslib2021/);
  assert.match(output, /  default/);
  assert.match(output, /status:\s+ok/);
  assert.match(output, /toolset:\s+v143/);
  assert.match(output, /vs:\s+Visual Studio 2022 Community/);
});

test('switches active profile and rejects missing profile', async () => {
  const workspace = await prepareHome();
  await createFakeVisualStudio(workspace);
  const fakeDefault = await createFakeGslibNamed(workspace, 'default-gslib');
  const fakeOther = await createFakeGslibNamed(workspace, 'gslib2021');
  await writeConfig(makeConfig({
    default: makeProfile(fakeDefault),
    gslib2021: makeProfile(fakeOther)
  }));

  await useProfile('gslib2021');
  const saved = JSON.parse(await fs.readFile(configPath(), 'utf8'));
  assert.equal(saved.activeProfile, 'gslib2021');
  await assert.rejects(() => useProfile('missing'), /GSLIB profile not found/);
});

test('removes profile and refuses active profile without force', async () => {
  const workspace = await prepareHome();
  await createFakeVisualStudio(workspace);
  const fakeDefault = await createFakeGslibNamed(workspace, 'default-gslib');
  const fakeOther = await createFakeGslibNamed(workspace, 'old-gslib');
  await writeConfig(makeConfig({
    default: makeProfile(fakeDefault),
    oldProfile: makeProfile(fakeOther)
  }));

  await removeProfile('oldProfile');
  let saved = JSON.parse(await fs.readFile(configPath(), 'utf8'));
  assert.equal(saved.profiles.oldProfile, undefined);

  await assert.rejects(() => removeProfile('default'), /Cannot remove active profile/);
  await removeProfile('default', { force: true });
  saved = JSON.parse(await fs.readFile(configPath(), 'utf8'));
  assert.equal(saved.activeProfile, null);
});

test('doctor reports ok, reports error, and does not modify config', async () => {
  const workspace = await prepareHome();
  await createFakeVisualStudio(workspace);
  const fake = await createFakeGslibNamed(workspace, 'fake-gslib');
  await writeConfig(makeConfig({ default: makeProfile(fake) }));

  let before = await fs.readFile(configPath(), 'utf8');
  let output = await captureConsole(() => doctor());
  assert.match(output, /Result:\n  ok/);
  assert.match(output, /Toolset status: ok/);
  assert.equal(await fs.readFile(configPath(), 'utf8'), before);

  const broken = makeConfig({ default: makeProfile(fake, { libDir: path.join(fake, 'missing-lib') }) });
  await writeConfig(broken);
  before = await fs.readFile(configPath(), 'utf8');
  output = await captureConsole(() => doctor());
  assert.match(output, /Result:\n  error/);
  assert.equal(await fs.readFile(configPath(), 'utf8'), before);
});

test('shows config content and handles missing config', async () => {
  const workspace = await prepareHome();
  await createFakeVisualStudio(workspace);
  const fake = await createFakeGslibNamed(workspace, 'fake-gslib');
  await writeConfig(makeConfig({ default: makeProfile(fake) }));

  let output = await captureConsole(() => showConfig());
  assert.match(output, /Config path:/);
  assert.match(output, /"version": 2/);

  await prepareHome();
  output = await captureConsole(() => showConfig());
  assert.match(output, /not found/);
});

async function prepareHome() {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  process.env.USERPROFILE = path.join(workspace, 'home');
  return workspace;
}

async function captureConsole(fn) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lines.join('\n');
}
