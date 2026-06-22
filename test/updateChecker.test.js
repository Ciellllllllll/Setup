import test from 'node:test';
import assert from 'node:assert/strict';
import { checkForUpdate, registryLatestUrl, runAutomaticUpdateCheck, runManualUpdateCheck } from '../src/updateChecker.js';

const packageInfo = {
  packageName: '@ciellllllllll/setup',
  currentVersion: '0.1.0'
};

test('reports update when latest version is newer', async () => {
  const result = await checkForUpdate({
    packageInfo,
    readState: async () => null,
    writeState: async () => {},
    fetchLatest: async () => ({ version: '0.2.0' }),
    now: new Date('2026-06-22T00:00:00.000Z')
  });

  assert.equal(result.updateAvailable, true);
  assert.match(result.message, /0\.1\.0 -> 0\.2\.0/);
  assert.match(result.message, /npm install -g @ciellllllllll\/setup/);
});

test('does not report update when latest version is same or older', async () => {
  for (const version of ['0.1.0', '0.0.9']) {
    const result = await checkForUpdate({
      packageInfo,
      readState: async () => null,
      writeState: async () => {},
      fetchLatest: async () => ({ version })
    });
    assert.equal(result.updateAvailable, false);
    assert.equal(result.message, '');
  }
});

test('manual check reports up to date', async () => {
  const output = await captureConsole(() => runManualUpdateCheck({
    packageInfo: { ...packageInfo, currentVersion: '0.2.0' },
    readState: async () => null,
    writeState: async () => {},
    fetchLatest: async () => ({ version: '0.2.0' })
  }));

  assert.match(output, /Setup is up to date/);
  assert.match(output, /0\.2\.0/);
});

test('skips automatic check within 24 hours', async () => {
  let fetchCalls = 0;
  const result = await checkForUpdate({
    packageInfo,
    readState: async () => ({
      version: 1,
      packageName: packageInfo.packageName,
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      lastCheckedAt: '2026-06-21T01:00:00.000Z',
      lastResult: 'update-available'
    }),
    writeState: async () => {},
    fetchLatest: async () => {
      fetchCalls += 1;
      return { version: '0.3.0' };
    },
    now: new Date('2026-06-22T00:00:00.000Z')
  });

  assert.equal(fetchCalls, 0);
  assert.equal(result.updateAvailable, true);
});

test('checks after 24 hours and writes state', async () => {
  let fetchCalls = 0;
  let written = null;
  await checkForUpdate({
    packageInfo,
    readState: async () => ({
      lastCheckedAt: '2026-06-20T23:00:00.000Z'
    }),
    writeState: async (state) => { written = state; },
    fetchLatest: async () => {
      fetchCalls += 1;
      return { version: '0.2.0' };
    },
    now: new Date('2026-06-22T00:00:00.000Z')
  });

  assert.equal(fetchCalls, 1);
  assert.equal(written.lastResult, 'update-available');
});

test('force ignores 24 hour cache', async () => {
  let fetchCalls = 0;
  await checkForUpdate({
    packageInfo,
    force: true,
    readState: async () => ({ lastCheckedAt: '2026-06-21T23:59:00.000Z' }),
    writeState: async () => {},
    fetchLatest: async () => {
      fetchCalls += 1;
      return { version: '0.2.0' };
    },
    now: new Date('2026-06-22T00:00:00.000Z')
  });

  assert.equal(fetchCalls, 1);
});

test('automatic check failure does not throw or print', async () => {
  const output = await captureConsole(() => runAutomaticUpdateCheck({
    packageInfo,
    readState: async () => null,
    writeState: async () => {},
    fetchLatest: async () => { throw new Error('network'); }
  }));

  assert.equal(output, '');
});

test('manual check failure is displayed', async () => {
  const output = await captureConsole(() => runManualUpdateCheck({
    packageInfo,
    readState: async () => null,
    writeState: async () => {},
    fetchLatest: async () => { throw new Error('network'); }
  }));

  assert.match(output, /Update check failed/);
  assert.match(output, /@ciellllllllll\/setup/);
});

test('registry latest URL encodes scoped package name', () => {
  assert.equal(
    registryLatestUrl('@ciellllllllll/setup'),
    'https://registry.npmjs.org/@ciellllllllll%2Fsetup/latest'
  );
});

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
