import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const VSWHERE = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
const EDITIONS = ['Community', 'Professional', 'Enterprise', 'BuildTools'];

export async function detectVisualStudioToolsets(options = {}) {
  const installations = await findVisualStudioInstallations(options);
  for (const installationPath of installations) {
    const platformToolsetsPath = path.join(installationPath, 'MSBuild', 'Microsoft', 'VC', 'v170', 'Platforms', 'Win32', 'PlatformToolsets');
    const detectedToolsets = await readToolsets(platformToolsetsPath);
    if (detectedToolsets.length === 0) continue;
    const selectedToolset = options.requestedToolset || detectedToolsets[0];
    if (!detectedToolsets.includes(selectedToolset)) {
      throw new Error(`PlatformToolset is not available:\n  ${selectedToolset}\n\nRun:\n  Setup --toolsets`);
    }
    return {
      selectedToolset,
      visualStudio: {
        version: '17',
        displayName: displayName(installationPath),
        installationPath,
        vcTargetsPath: path.join(installationPath, 'MSBuild', 'Microsoft', 'VC', 'v170'),
        platformToolsetsPath,
        detectedToolsets,
        detectedAt: (options.now || new Date()).toISOString()
      }
    };
  }

  if (options.requestedToolset) {
    throw new Error(`PlatformToolset is not available:\n  ${options.requestedToolset}\n\nRun:\n  Setup --toolsets`);
  }
  throw new Error('Visual Studio C++ PlatformToolset was not found.\n\nExpected:\n  Visual Studio 2022 C++ workload\n  Win32 PlatformToolset\n\nInstall Visual Studio 2022 with C++ desktop development workload,\nthen run:\n  Setup --find');
}

export async function isToolsetAvailable(profile) {
  if (!profile?.visualStudio?.platformToolsetsPath || !profile.toolset) return false;
  return fileExists(path.join(profile.visualStudio.platformToolsetsPath, profile.toolset, 'Toolset.props'));
}

export async function findVisualStudioInstallations(options = {}) {
  const roots = [
    ...(options.candidateRoots || []),
    ...envCandidateRoots()
  ];
  const fromRoots = roots.flatMap((root) => candidateInstallPaths(root));
  const useMachineDefaults = roots.length === 0;
  const fromVswhere = options.skipVswhere || !useMachineDefaults ? [] : await vswhereInstallations();
  const fallback = useMachineDefaults ? defaultInstallPaths() : [];
  const unique = [...new Set([...fromRoots, ...fromVswhere, ...fallback])];
  const existing = [];
  for (const candidate of unique) {
    if (await directoryExists(candidate)) existing.push(candidate);
  }
  return existing.sort((a, b) => scoreInstall(b) - scoreInstall(a));
}

async function readToolsets(platformToolsetsPath) {
  try {
    const entries = await fs.readdir(platformToolsetsPath, { withFileTypes: true });
    const toolsets = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (await fileExists(path.join(platformToolsetsPath, entry.name, 'Toolset.props'))) {
        toolsets.push(entry.name);
      }
    }
    return toolsets.sort(compareToolsets);
  } catch {
    return [];
  }
}

function compareToolsets(a, b) {
  return toolsetNumber(b) - toolsetNumber(a) || b.localeCompare(a);
}

function toolsetNumber(value) {
  const match = /^v(\d+)$/.exec(value);
  return match ? Number(match[1]) : 0;
}

function candidateInstallPaths(root) {
  return [
    root,
    ...EDITIONS.map((edition) => path.join(root, '2022', edition)),
    ...EDITIONS.map((edition) => path.join(root, 'Microsoft Visual Studio', '2022', edition))
  ];
}

function defaultInstallPaths() {
  return [
    ...EDITIONS.map((edition) => `C:\\Program Files\\Microsoft Visual Studio\\2022\\${edition}`),
    ...EDITIONS.map((edition) => `C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\${edition}`)
  ];
}

async function vswhereInstallations() {
  if (!(await fileExists(VSWHERE))) return [];
  const result = spawnSync(VSWHERE, ['-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-format', 'json'], {
    encoding: 'utf8',
    shell: false
  });
  if (result.status !== 0 || !result.stdout) return [];
  try {
    return JSON.parse(result.stdout).map((item) => item.installationPath).filter(Boolean);
  } catch {
    return [];
  }
}

function envCandidateRoots() {
  return process.env.SETUP_TEST_VS_ROOT ? process.env.SETUP_TEST_VS_ROOT.split(path.delimiter).filter(Boolean) : [];
}

function scoreInstall(installationPath) {
  const normalized = installationPath.toLowerCase();
  let score = normalized.includes('\\2022\\') || normalized.includes('/2022/') ? 100 : 0;
  if (normalized.includes('community')) score += 4;
  if (normalized.includes('professional')) score += 3;
  if (normalized.includes('enterprise')) score += 2;
  if (normalized.includes('buildtools')) score += 1;
  return score;
}

function displayName(installationPath) {
  const edition = EDITIONS.find((item) => installationPath.toLowerCase().includes(item.toLowerCase()));
  return edition ? `Visual Studio 2022 ${edition}` : 'Visual Studio 2022';
}

async function directoryExists(dir) {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(file) {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}
