import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { saveProfile } from './config.js';
import { assertSafeProfileName, userHome } from './pathUtils.js';
import { detectVisualStudioToolsets } from './toolsetDetector.js';

const INCLUDE_DIRS = ['include', 'Include', 'inc', 'Inc', '.'];
const LIB_DIRS = ['lib/x86', 'lib/Win32', 'Lib/x86', 'Lib/Win32', 'lib', 'Lib', '.'];
const BIN_DIRS = ['bin/x86', 'bin/Win32', 'Bin/x86', 'Bin/Win32', 'bin', 'Bin'];
const NAMES = ['gslib', 'GSLIB', 'gslib_2021', 'GSLIB_2021', 'gsLib', 'GSLib'];

export async function findAndSaveGslib(rootArg, options = {}) {
  const profileName = options.profileName || 'default';
  assertSafeProfileName(profileName);
  const detected = await detectVisualStudioToolsets({
    candidateRoots: options.candidateRoots,
    requestedToolset: options.requestedToolset,
    skipVswhere: options.skipVswhere,
    now: options.now
  });
  if (rootArg) {
    const config = await validateGslibRoot(path.resolve(rootArg));
    if (!config) {
      throw new Error('Invalid GSLIB directory.\ninclude directory or .lib files were not found.');
    }
    const profile = withToolset(config, detected);
    await saveProfile(profileName, profile, options.now);
    printSaved(profile);
    return profile;
  }

  const candidates = await findCandidates();
  if (candidates.length === 0) {
    throw new Error('GSLIB directory was not found.\nSpecify it manually:\n  Setup --find "C:\\path\\to\\gslib_2021"');
  }

  const selected = candidates.length === 1 ? candidates[0] : await selectCandidate(candidates);
  const profile = withToolset(selected, detected);
  await saveProfile(profileName, profile, options.now);
  printSaved(profile);
  return profile;
}

export async function validateGslibRoot(root) {
  if (!(await isDirectory(root))) return null;
  const includeDir = await firstDirWith(root, INCLUDE_DIRS, ['.h', '.hpp']);
  const libDir = await firstDirWith(root, LIB_DIRS, ['.lib'], true);
  if (!includeDir || !libDir) return null;
  const binDir = await firstDirWith(root, BIN_DIRS, ['.dll'], true);
  return {
    gslibRoot: root,
    includeDir,
    libDir,
    binDir,
    libraries: await listLibs(libDir),
    platform: 'Win32'
  };
}

export async function listLibs(libDir) {
  const entries = await fs.readdir(libDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.lib'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function firstDirWith(root, relativeDirs, extensions, skipX64 = false) {
  for (const relative of relativeDirs) {
    const candidate = path.resolve(root, relative);
    if (skipX64 && candidate.toLowerCase().includes('x64')) continue;
    if (await hasFileWithExtension(candidate, extensions)) return candidate;
  }
  return null;
}

async function hasFileWithExtension(dir, extensions) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && extensions.some((ext) => entry.name.toLowerCase().endsWith(ext)));
  } catch {
    return false;
  }
}

async function isDirectory(dir) {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

async function findCandidates() {
  const bases = [
    process.cwd(),
    path.dirname(process.cwd()),
    path.join(userHome(), 'Desktop'),
    path.join(userHome(), 'Downloads'),
    path.join(userHome(), 'Documents'),
    'C:\\Libraries',
    'D:\\Libraries',
    'C:\\lib',
    'D:\\lib',
    'C:\\libs',
    'D:\\libs',
    'C:\\GSLIB',
    'D:\\GSLIB'
  ];
  const roots = new Set();
  for (const base of bases) {
    roots.add(base);
    for (const name of NAMES) roots.add(path.join(base, name));
    for (const child of await safeChildren(base)) {
      for (const name of NAMES) roots.add(path.join(base, child, name));
    }
  }

  const candidates = [];
  const seen = new Set();
  for (const root of roots) {
    const config = await validateGslibRoot(root);
    if (config && !seen.has(config.gslibRoot)) {
      seen.add(config.gslibRoot);
      candidates.push(config);
    }
  }
  return candidates;
}

async function safeChildren(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function selectCandidate(candidates) {
  console.log('Multiple GSLIB candidates found:\n');
  candidates.forEach((candidate, index) => {
    console.log(`[${index + 1}] ${candidate.gslibRoot}`);
    console.log(`    include: ${candidate.includeDir}`);
    console.log(`    lib:     ${candidate.libDir}`);
    console.log(`    bin:     ${candidate.binDir || 'none'}\n`);
  });
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question('Select number: ');
  rl.close();
  const index = Number.parseInt(answer, 10) - 1;
  if (!Number.isInteger(index) || !candidates[index]) throw new Error('Invalid selection.');
  return candidates[index];
}

function printSaved(config) {
  console.log('Saved GSLIB configuration.');
  console.log(`include: ${config.includeDir}`);
  console.log(`lib:     ${config.libDir}`);
  console.log(`bin:     ${config.binDir || 'none'}`);
  console.log(`toolset: ${config.toolset}`);
}

function withToolset(config, detected) {
  return {
    ...config,
    toolset: detected.selectedToolset,
    visualStudio: detected.visualStudio
  };
}
