import fs from 'node:fs/promises';
import path from 'node:path';
import { userHome } from './pathUtils.js';
import { isToolsetAvailable } from './toolsetDetector.js';

export function configDir() {
  return path.join(userHome(), '.gslib-setup');
}

export function configPath() {
  return path.join(configDir(), 'config.json');
}

export async function writeConfig(config) {
  await fs.mkdir(configDir(), { recursive: true });
  const target = configPath();
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await fs.rename(temp, target);
}

export async function readConfig() {
  try {
    const parsed = JSON.parse(await fs.readFile(configPath(), 'utf8'));
    if (parsed.version === 1) {
      throw new Error('Config format is old and does not contain Visual Studio toolset information.\n\nRun:\n  Setup --find');
    }
    if (parsed.version !== 2 || typeof parsed.profiles !== 'object' || !parsed.profiles) {
      throw new Error('Saved GSLIB configuration is invalid.\n\nRun:\n  Setup --find');
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('GSLIB is not configured.\n\nRun:\n  Setup --find');
    }
    if (error instanceof SyntaxError) throw corruptedConfigError();
    throw error;
  }
}

export async function tryReadConfig() {
  try {
    return { config: await readConfig(), error: null };
  } catch (error) {
    return { config: null, error };
  }
}

export async function saveProfile(profileName, gslibProfile, now = new Date()) {
  let config;
  try {
    config = await readConfig();
  } catch (error) {
    if (error.message.startsWith('GSLIB is not configured.')) {
      config = { version: 2, activeProfile: profileName, profiles: {} };
    } else {
      throw error;
    }
  }

  const existing = config.profiles[profileName];
  const timestamp = now.toISOString();
  config.profiles[profileName] = {
    label: 'GSLIB',
    ...gslibProfile,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  };
  config.activeProfile = profileName;
  await writeConfig(config);
  return config.profiles[profileName];
}

export async function loadConfig(profileName = null) {
  const config = await readConfig();
  const activeProfile = profileName || config.activeProfile;
  const profile = activeProfile ? config.profiles[activeProfile] : null;
  if (!profile) {
    throw new Error('Saved GSLIB configuration is invalid.\n\nRun:\n  Setup --find');
  }
  return validateSavedProfile(activeProfile, profile);
}

export async function validateSavedProfile(profileName, profile) {
  const missing = [];
  if (!(await isDirectory(profile.gslibRoot))) missing.push(profile.gslibRoot);
  if (!(await isDirectory(profile.includeDir))) missing.push(profile.includeDir);
  if (!(await isDirectory(profile.libDir))) missing.push(profile.libDir);
  for (const library of profile.libraries || []) {
    if (!(await isFile(path.join(profile.libDir, library)))) missing.push(path.join(profile.libDir, library));
  }
  if (profile.binDir !== null && profile.binDir !== undefined && !(await isDirectory(profile.binDir))) {
    missing.push(profile.binDir);
  }
  if (profile.platform !== 'Win32') missing.push(`${profileName}: platform must be Win32`);
  if (!profile.toolset) missing.push(`${profileName}: toolset`);
  if (!profile.visualStudio) missing.push(`${profileName}: visualStudio`);
  if (profile.visualStudio && !(await isDirectory(profile.visualStudio.installationPath))) {
    missing.push(profile.visualStudio.installationPath);
  }
  if (profile.visualStudio && !(await isDirectory(profile.visualStudio.platformToolsetsPath))) {
    missing.push(profile.visualStudio.platformToolsetsPath);
  }
  if (profile.visualStudio && Array.isArray(profile.visualStudio.detectedToolsets) && !profile.visualStudio.detectedToolsets.includes(profile.toolset)) {
    missing.push(`${profileName}: toolset is not in detectedToolsets`);
  }
  if (profile.visualStudio && !(await isToolsetAvailable(profile))) {
    throw new Error(`Saved Visual Studio PlatformToolset is not available:\n  ${profile.toolset}\n\nRun:\n  Setup --find`);
  }
  if (!Array.isArray(profile.libraries)) missing.push(`${profileName}: libraries`);

  if (missing.length > 0) {
    throw new Error(`Saved GSLIB configuration is invalid.\n\nMissing:\n  ${missing.join('\n  ')}\n\nRun:\n  Setup --find`);
  }
  return profile;
}

export function corruptedConfigError() {
  return new Error(`Config file is corrupted:\n  ${configPath()}\n\nFix or delete the file, then run:\n  Setup --find`);
}

async function isDirectory(dir) {
  if (!dir) return false;
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(file) {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}
