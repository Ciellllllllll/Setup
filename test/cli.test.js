import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../src/cli.js';
import { configPath, writeConfig } from '../src/config.js';
import { createFakeGslibNamed, createFakeVisualStudio, makeConfig, makeProfile } from '../test-support/helpers.js';

test('CLI saves named profile with --as and generates after switching profile', async () => {
  const workspace = await prepareHome();
  const vs = await createFakeVisualStudio(workspace);
  process.env.SETUP_TEST_VS_ROOT = vs.root;
  const fakeDefault = await createFakeGslibNamed(workspace, 'default-gslib');
  const fakeOther = await createFakeGslibNamed(workspace, 'gslib2021');

  await captureConsole(() => runCli(['--find', fakeDefault]));
  await captureConsole(() => runCli(['--find', fakeOther, '--as', 'gslib2021']));

  const saved = JSON.parse(await fs.readFile(configPath(), 'utf8'));
  assert.equal(saved.activeProfile, 'gslib2021');
  assert.ok(saved.profiles.default);
  assert.ok(saved.profiles.gslib2021);
  await captureConsole(() => runCli(['--use', 'default']));

  const projectRoot = path.join(workspace, 'ProfileProject');
  await captureConsole(async () => {
    const originalCwd = process.cwd();
    process.chdir(workspace);
    try {
      await runCli(['ProfileProject']);
    } finally {
      process.chdir(originalCwd);
    }
  });

  const vcxproj = await fs.readFile(path.join(projectRoot, 'ProfileProject.vcxproj'), 'utf8');
  assert.match(vcxproj, /default-gslib\\include/);
});

test('CLI normalizes non-ASCII hyphens in options', async () => {
  const workspace = await prepareHome();
  const vs = await createFakeVisualStudio(workspace);
  process.env.SETUP_TEST_VS_ROOT = vs.root;
  const fake = await createFakeGslibNamed(workspace, 'fake-gslib');

  await captureConsole(() => runCli(['––find', fake]));
  const saved = JSON.parse(await fs.readFile(configPath(), 'utf8'));

  assert.equal(saved.activeProfile, 'default');
});

test('corrupted config is not overwritten by find command', async () => {
  const workspace = await prepareHome();
  const vs = await createFakeVisualStudio(workspace);
  process.env.SETUP_TEST_VS_ROOT = vs.root;
  const fake = await createFakeGslibNamed(workspace, 'fake-gslib');
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), '{ broken json', 'utf8');

  await assert.rejects(() => runCli(['--find', fake]), /Config file is corrupted/);
  assert.equal(await fs.readFile(configPath(), 'utf8'), '{ broken json');
});

test('CLI --config handles missing config', async () => {
  await prepareHome();
  const output = await captureConsole(() => runCli(['--config']));

  assert.match(output, /Config path:/);
  assert.match(output, /not found/);
});

test('CLI use switches active profile', async () => {
  const workspace = await prepareHome();
  await createFakeVisualStudio(workspace);
  const fakeDefault = await createFakeGslibNamed(workspace, 'default-gslib');
  const fakeOther = await createFakeGslibNamed(workspace, 'gslib2021');
  await writeConfig(makeConfig({
    default: makeProfile(fakeDefault),
    gslib2021: makeProfile(fakeOther)
  }));

  await captureConsole(() => runCli(['--use', 'gslib2021']));
  const saved = JSON.parse(await fs.readFile(configPath(), 'utf8'));

  assert.equal(saved.activeProfile, 'gslib2021');
});

test('CLI saves requested toolset when available and rejects unavailable toolset', async () => {
  const workspace = await prepareHome();
  const vs = await createFakeVisualStudio(workspace);
  process.env.SETUP_TEST_VS_ROOT = vs.root;
  const fake = await createFakeGslibNamed(workspace, 'fake-gslib');

  await captureConsole(() => runCli(['--find', fake, '--toolset', 'v142']));
  let saved = JSON.parse(await fs.readFile(configPath(), 'utf8'));
  assert.equal(saved.profiles.default.toolset, 'v142');

  await fs.rm(path.dirname(configPath()), { recursive: true, force: true });
  await assert.rejects(() => runCli(['--find', fake, '--toolset', 'v141']), /PlatformToolset is not available/);
  await assert.rejects(() => fs.stat(configPath()), /ENOENT/);
});

test('CLI lists and switches active profile toolset', async () => {
  const workspace = await prepareHome();
  const vs = await createFakeVisualStudio(workspace);
  process.env.SETUP_TEST_VS_ROOT = vs.root;
  const fake = await createFakeGslibNamed(workspace, 'fake-gslib');
  await writeConfig(makeConfig({ default: makeProfile(fake) }));

  let output = await captureConsole(() => runCli(['--toolsets']));
  assert.match(output, /v143/);
  assert.match(output, /v142/);
  assert.match(output, /Active toolset/);

  await captureConsole(() => runCli(['--toolset', 'v142']));
  const saved = JSON.parse(await fs.readFile(configPath(), 'utf8'));
  assert.equal(saved.profiles.default.toolset, 'v142');
});

test('CLI creates default, direct-name, --name, and -- name projects', async () => {
  const workspace = await prepareHome();
  await createFakeVisualStudio(workspace);
  const fake = await createFakeGslibNamed(workspace, 'fake-gslib');
  await writeConfig(makeConfig({ default: makeProfile(fake) }));
  const originalCwd = process.cwd();
  process.chdir(workspace);
  try {
    await captureConsole(() => runCli([]));
    await captureConsole(() => runCli(['MyGame']));
    await captureConsole(() => runCli(['--name', 'NamedGame']));
    await captureConsole(() => runCli(['--', 'DashedGame']));
  } finally {
    process.chdir(originalCwd);
  }

  assert.equal(await exists(path.join(workspace, `${todayName()}_Project`, 'GSLIB_Project.vcxproj')), true);
  assert.equal(await exists(path.join(workspace, 'MyGame', 'MyGame.vcxproj')), true);
  assert.equal(await exists(path.join(workspace, 'NamedGame', 'NamedGame.vcxproj')), true);
  assert.equal(await exists(path.join(workspace, 'DashedGame', 'DashedGame.vcxproj')), true);
});

test('CLI config-path, help, version, list, remove, doctor use new commands', async () => {
  const workspace = await prepareHome();
  await createFakeVisualStudio(workspace);
  const fakeDefault = await createFakeGslibNamed(workspace, 'default-gslib');
  const fakeOther = await createFakeGslibNamed(workspace, 'old-gslib');
  await writeConfig(makeConfig({
    default: makeProfile(fakeDefault),
    oldProfile: makeProfile(fakeOther)
  }));

  let output = await captureConsole(() => runCli(['--config-path']));
  assert.equal(output.trim(), configPath());

  output = await captureConsole(() => runCli(['--help']));
  assert.match(output, /Setup --find/);
  assert.match(output, /Setup --toolsets/);
  assert.match(output, /Setup update \[--force\]/);
  assert.match(output, /Setup --update-check/);
  assert.doesNotMatch(output, /Setup gslib --find/);
  assert.doesNotMatch(output, /Setup Make gslib/);

  output = await captureConsole(() => runCli(['--version']));
  assert.match(output.trim(), /^\d+\.\d+\.\d+$/);

  output = await captureConsole(() => runCli(['--list']));
  assert.match(output, /\* default/);

  output = await captureConsole(() => runCli(['--doctor']));
  assert.match(output, /Result:\n  ok/);

  await captureConsole(() => runCli(['--remove', 'oldProfile']));
  const saved = JSON.parse(await fs.readFile(configPath(), 'utf8'));
  assert.equal(saved.profiles.oldProfile, undefined);
});

test('CLI reports migration guidance for removed command styles', async () => {
  await assert.rejects(() => runCli(['gslib', '--find']), /Setup --find/);
  await assert.rejects(() => runCli(['Make', 'gslib']), /Setup/);
});

test('CLI uninstall aliases are not treated as project names', async () => {
  const workspace = await prepareHome();
  const calls = [];
  await fs.mkdir(path.dirname(configPath()), { recursive: true });

  const originalCwd = process.cwd();
  process.chdir(workspace);
  try {
    await captureConsole(() => run(['uninstall', '--force'], {
      runAutomaticUpdateCheck: async () => { throw new Error('unexpected automatic update check'); },
      uninstall: {
        packageName: '@ciellllllllll/setup',
        npmUninstall: (packageName) => {
          calls.push(packageName);
          return { status: 0 };
        }
      }
    }));
  } finally {
    process.chdir(originalCwd);
  }

  assert.deepEqual(calls, ['@ciellllllllll/setup']);
  assert.equal(await exists(path.join(workspace, 'uninstall')), false);
});

test('CLI dashed uninstall alias is not treated as a project name', async () => {
  await prepareHome();
  const calls = [];

  await captureConsole(() => run(['--', 'uninstall', '--force'], {
    uninstall: {
      packageName: '@ciellllllllll/setup',
      npmUninstall: (packageName) => {
        calls.push(packageName);
        return { status: 0 };
      }
    }
  }));

  assert.deepEqual(calls, ['@ciellllllllll/setup']);
});

test('CLI automatic update check runs only for target commands', async () => {
  await prepareHome();
  let calls = 0;
  await captureConsole(() => run(['--config'], { runAutomaticUpdateCheck: async () => { calls += 1; } }));
  assert.equal(calls, 1);

  calls = 0;
  await captureConsole(() => run(['--version'], { runAutomaticUpdateCheck: async () => { calls += 1; } }));
  await captureConsole(() => run(['--help'], { runAutomaticUpdateCheck: async () => { calls += 1; } }));
  await captureConsole(() => run(['--config-path'], { runAutomaticUpdateCheck: async () => { calls += 1; } }));
  await captureConsole(() => run(['update'], {
    runAutomaticUpdateCheck: async () => { calls += 1; },
    updateCheck: {
      packageInfo: { packageName: '@ciellllllllll/setup', currentVersion: '0.1.0' },
      readState: async () => null,
      writeState: async () => {},
      fetchLatest: async () => ({ version: '0.1.0' })
    }
  }));
  assert.equal(calls, 0);
});

test('CLI manual update check uses explicit command without automatic check', async () => {
  await prepareHome();
  let autoCalls = 0;
  const output = await captureConsole(() => run(['--update-check', '--force'], {
    runAutomaticUpdateCheck: async () => { autoCalls += 1; },
    updateCheck: {
      packageInfo: { packageName: '@ciellllllllll/setup', currentVersion: '0.1.0' },
      readState: async () => null,
      writeState: async () => {},
      fetchLatest: async () => ({ version: '0.2.0' })
    }
  }));

  assert.equal(autoCalls, 0);
  assert.match(output, /Update available: Setup 0\.1\.0 -> 0\.2\.0/);
});

test('CLI update command ignores update check cooldown', async () => {
  await prepareHome();
  let fetchCalls = 0;
  const output = await captureConsole(() => run(['update'], {
    updateCheck: {
      packageInfo: { packageName: '@ciellllllllll/setup', currentVersion: '0.1.0' },
      readState: async () => ({
        version: 1,
        packageName: '@ciellllllllll/setup',
        currentVersion: '0.1.0',
        latestVersion: '0.1.0',
        lastCheckedAt: new Date().toISOString(),
        lastResult: 'up-to-date'
      }),
      writeState: async () => {},
      fetchLatest: async () => {
        fetchCalls += 1;
        return { version: '0.2.0' };
      }
    }
  }));

  assert.equal(fetchCalls, 1);
  assert.match(output, /Update available: Setup 0\.1\.0 -> 0\.2\.0/);
});

async function prepareHome() {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  process.env.USERPROFILE = path.join(workspace, 'home');
  delete process.env.SETUP_TEST_VS_ROOT;
  return workspace;
}

function runCli(args) {
  return run(args, { runAutomaticUpdateCheck: async () => {} });
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

async function exists(target) {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

function todayName() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getFullYear()).slice(-2)}`;
}
