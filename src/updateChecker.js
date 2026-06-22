import { readPackageInfo } from './packageInfo.js';
import { readUpdateCheckState, writeUpdateCheckState } from './updateCheckState.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runAutomaticUpdateCheck(options = {}) {
  try {
    const result = await checkForUpdate({ ...options, force: false });
    if (result.updateAvailable && result.message) console.log(result.message);
    return result;
  } catch {
    return { lastResult: 'failed' };
  }
}

export async function runManualUpdateCheck(options = {}) {
  const result = await checkForUpdate({ ...options, force: Boolean(options.force), manual: true });
  console.log(result.message);
  return result;
}

export async function checkForUpdate(options = {}) {
  const now = options.now || new Date();
  const packageInfo = options.packageInfo || await readPackageInfo();
  const readState = options.readState || readUpdateCheckState;
  const writeState = options.writeState || writeUpdateCheckState;
  const fetchLatest = options.fetchLatest || fetchLatestPackageInfo;
  const previous = await readState();

  if (!options.force && previous?.lastCheckedAt && now.getTime() - Date.parse(previous.lastCheckedAt) < DAY_MS) {
    return resultFromState(previous, packageInfo, Boolean(options.manual));
  }

  try {
    const latest = await fetchLatest(packageInfo.packageName, options);
    const latestVersion = latest.version;
    const comparison = compareSemver(latestVersion, packageInfo.currentVersion);
    const updateAvailable = comparison > 0;
    const state = {
      version: 1,
      packageName: packageInfo.packageName,
      currentVersion: packageInfo.currentVersion,
      latestVersion,
      lastCheckedAt: now.toISOString(),
      lastResult: updateAvailable ? 'update-available' : 'up-to-date'
    };
    await writeState(state);
    return {
      ...state,
      updateAvailable,
      message: updateAvailable ? updateMessage(packageInfo.packageName, packageInfo.currentVersion, latestVersion) : upToDateMessage(packageInfo.currentVersion, Boolean(options.manual))
    };
  } catch (error) {
    const state = {
      version: 1,
      packageName: packageInfo.packageName,
      currentVersion: packageInfo.currentVersion,
      latestVersion: previous?.latestVersion || null,
      lastCheckedAt: now.toISOString(),
      lastResult: 'failed'
    };
    await writeState(state);
    if (options.manual) {
      return {
        ...state,
        updateAvailable: false,
        message: `Update check failed.\n\nThe package may not be published to npm yet:\n  ${packageInfo.packageName}`,
        error
      };
    }
    return { ...state, updateAvailable: false, message: '', error };
  }
}

export async function fetchLatestPackageInfo(packageName, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!fetchImpl) throw new Error('fetch is not available');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 3000);
  try {
    const response = await fetchImpl(registryLatestUrl(packageName), { signal: controller.signal });
    if (!response.ok) throw new Error(`npm registry returned ${response.status}`);
    const data = await response.json();
    if (!data?.version) throw new Error('npm registry response did not contain version');
    return { version: data.version };
  } finally {
    clearTimeout(timeout);
  }
}

export function registryLatestUrl(packageName) {
  return `https://registry.npmjs.org/${packageName.replaceAll('/', '%2F')}/latest`;
}

export function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }
  return 0;
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function resultFromState(state, packageInfo, manual) {
  const updateAvailable = state.lastResult === 'update-available' && compareSemver(state.latestVersion, packageInfo.currentVersion) > 0;
  return {
    ...state,
    updateAvailable,
    message: updateAvailable ? updateMessage(packageInfo.packageName, packageInfo.currentVersion, state.latestVersion) : upToDateMessage(packageInfo.currentVersion, manual)
  };
}

function updateMessage(packageName, currentVersion, latestVersion) {
  return `Update available: Setup ${currentVersion} -> ${latestVersion}\n\nRun:\n  npm install -g ${packageName}`;
}

function upToDateMessage(currentVersion, manual) {
  return manual ? `Setup is up to date.\n\nCurrent:\n  ${currentVersion}` : '';
}
