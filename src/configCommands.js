import fs from 'node:fs/promises';
import path from 'node:path';
import { configPath, readConfig, tryReadConfig, validateSavedProfile, writeConfig } from './config.js';
import { assertSafeProfileName } from './pathUtils.js';

export async function showConfig() {
  console.log('Config path:');
  console.log(`  ${configPath()}\n`);
  console.log('Config:');
  try {
    console.log(await fs.readFile(configPath(), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.log('  not found\n');
    console.log('Run:');
    console.log('  Setup --find');
  }
}

export async function listProfiles() {
  const config = await readConfig();
  const names = Object.keys(config.profiles || {});
  if (names.length === 0) {
    console.log('No GSLIB profiles found.\n');
    console.log('Run:');
    console.log('  Setup --find');
    return;
  }
  console.log('GSLIB profiles:\n');
  for (const name of names) {
    const profile = config.profiles[name];
    const status = await profileStatus(name, profile);
    console.log(`${name === config.activeProfile ? '*' : ' '} ${name}`);
    console.log(`  label:    ${profile.label}`);
    console.log(`  root:     ${profile.gslibRoot}`);
    console.log(`  include:  ${profile.includeDir}`);
    console.log(`  lib:      ${profile.libDir}`);
    console.log(`  bin:      ${profile.binDir || 'none'}`);
    console.log('  platform: x86 (MSBuild: Win32)');
    console.log('  x64:      display only');
    console.log(`  toolset:  ${profile.toolset}`);
    console.log(`  vs:       ${profile.visualStudio?.displayName || 'unknown'}`);
    console.log(`  status:   ${status}\n`);
    console.log('  libraries:');
    for (const library of profile.libraries || []) console.log(`    ${library}`);
    console.log('');
  }
}

export async function useProfile(profileName) {
  assertSafeProfileName(profileName);
  const config = await readConfig();
  const profile = config.profiles[profileName];
  if (!profile) {
    throw new Error(`GSLIB profile not found:\n  ${profileName}\n\nRun:\n  Setup --list`);
  }
  try {
    await validateSavedProfile(profileName, profile);
  } catch {
    throw new Error(`GSLIB profile is invalid:\n  ${profileName}\n\nRun:\n  Setup --doctor`);
  }
  config.activeProfile = profileName;
  await writeConfig(config);
  console.log('Active GSLIB profile changed:');
  console.log(`  ${profileName}`);
}

export async function removeProfile(profileName, options = {}) {
  assertSafeProfileName(profileName);
  const config = await readConfig();
  if (!config.profiles[profileName]) throw new Error(`GSLIB profile not found:\n  ${profileName}`);
  if (config.activeProfile === profileName && !options.force) {
    throw new Error(`Cannot remove active profile:\n  ${profileName}\n\nSwitch to another profile first:\n  Setup --use <profile>`);
  }

  delete config.profiles[profileName];
  if (config.activeProfile === profileName) {
    config.activeProfile = Object.keys(config.profiles)[0] || null;
  }
  await writeConfig(config);
  console.log('Removed GSLIB profile:');
  console.log(`  ${profileName}`);
}

export async function doctor() {
  const { config, error } = await tryReadConfig();
  console.log('GSLIB setup doctor\n');
  console.log('Config:');
  console.log(`  ${configPath()}\n`);
  if (error) {
    console.log('Result:');
    console.log('  error\n');
    console.log('Fix:');
    console.log('  Setup --find');
    return { ok: false };
  }

  console.log('Active profile:');
  console.log(`  ${config.activeProfile || 'none'}\n`);
  console.log('Profiles:');
  let ok = true;
  if (config.activeProfile && !config.profiles[config.activeProfile]) ok = false;
  for (const [name, profile] of Object.entries(config.profiles)) {
    const errors = await profileErrors(name, profile);
    if (errors.length === 0) {
      console.log(`  [ok] ${name}`);
      console.log(`       root: ${profile.gslibRoot}`);
      console.log('       include: ok');
      console.log('       lib: ok');
      console.log(`       bin: ${profile.binDir ? 'ok' : 'none'}`);
      console.log(`       libraries: ${(profile.libraries || []).join(', ')}`);
      console.log('       platform: x86 (MSBuild: Win32)');
      console.log('       x64: display only');
      console.log('       ATL: false');
      console.log('       Toolset status: ok');
      console.log(`       Toolset selected: ${profile.toolset}`);
      console.log(`       Toolset available: ${(profile.visualStudio?.detectedToolsets || []).join(', ')}`);
    } else {
      ok = false;
      console.log(`  [error] ${name}`);
      for (const item of errors) console.log(`          ${item}`);
    }
  }
  console.log('\nResult:');
  console.log(`  ${ok ? 'ok' : 'error'}`);
  if (!ok) {
    console.log('\nFix:');
    console.log('  Setup --find');
  }
  return { ok };
}

async function profileStatus(name, profile) {
  return (await profileErrors(name, profile)).length === 0 ? 'ok' : 'error';
}

async function profileErrors(name, profile) {
  const errors = [];
  if (!(await existsDir(profile.gslibRoot))) errors.push(`missing gslibRoot: ${profile.gslibRoot}`);
  if (!(await existsDir(profile.includeDir))) errors.push(`missing includeDir: ${profile.includeDir}`);
  if (!(await existsDir(profile.libDir))) errors.push(`missing libDir: ${profile.libDir}`);
  for (const library of profile.libraries || []) {
    if (!(await existsFile(path.join(profile.libDir, library)))) errors.push(`missing library: ${path.join(profile.libDir, library)}`);
  }
  if (profile.binDir && !(await existsDir(profile.binDir))) errors.push(`missing binDir: ${profile.binDir}`);
  if (profile.platform !== 'Win32') errors.push('platform must be Win32');
  if (!Array.isArray(profile.libraries)) errors.push(`${name}: libraries must be an array`);
  if (!profile.visualStudio) {
    errors.push('Toolset status: error');
    errors.push('missing visualStudio');
  } else {
    if (!(await existsDir(profile.visualStudio.installationPath))) errors.push(`missing Visual Studio: ${profile.visualStudio.installationPath}`);
    if (!(await existsDir(profile.visualStudio.platformToolsetsPath))) errors.push(`missing PlatformToolsets: ${profile.visualStudio.platformToolsetsPath}`);
    if (!profile.visualStudio.detectedToolsets?.includes(profile.toolset)) errors.push(`toolset not detected: ${profile.toolset}`);
    const props = path.join(profile.visualStudio.platformToolsetsPath, profile.toolset || '', 'Toolset.props');
    if (!(await existsFile(props))) {
      errors.push('Toolset status: error');
      errors.push(`missing: ${props}`);
    }
  }
  return errors;
}

async function existsDir(dir) {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

async function existsFile(file) {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}
