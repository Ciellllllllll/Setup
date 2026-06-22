import fs from 'node:fs/promises';
import path from 'node:path';

export async function createFakeGslib(workspace) {
  const fake = path.join(workspace, 'fake-gslib');
  await fs.mkdir(path.join(fake, 'include'), { recursive: true });
  await fs.mkdir(path.join(fake, 'lib'), { recursive: true });
  await fs.mkdir(path.join(fake, 'bin'), { recursive: true });
  await fs.writeFile(path.join(fake, 'include', 'GSgame.h'), '');
  await fs.writeFile(path.join(fake, 'lib', 'gslib.lib'), '');
  await fs.writeFile(path.join(fake, 'bin', 'gslib.dll'), '');
  return fake;
}

export async function createFakeGslibNamed(workspace, name) {
  const fake = path.join(workspace, name);
  await fs.mkdir(path.join(fake, 'include'), { recursive: true });
  await fs.mkdir(path.join(fake, 'lib'), { recursive: true });
  await fs.mkdir(path.join(fake, 'bin'), { recursive: true });
  await fs.writeFile(path.join(fake, 'include', 'GSgame.h'), '');
  await fs.writeFile(path.join(fake, 'lib', 'gslib.lib'), '');
  await fs.writeFile(path.join(fake, 'bin', 'gslib.dll'), '');
  return fake;
}

export function makeConfig(profiles, activeProfile = 'default') {
  return {
    version: 2,
    activeProfile,
    profiles
  };
}

export function makeProfile(fake, overrides = {}) {
  const visualStudio = overrides.visualStudio || makeVisualStudio(path.join(path.dirname(fake), 'fake-vs', '2022', 'Community'));
  return {
    label: 'GSLIB',
    gslibRoot: fake,
    includeDir: path.join(fake, 'include'),
    libDir: path.join(fake, 'lib'),
    binDir: path.join(fake, 'bin'),
    libraries: ['gslib.lib'],
    platform: 'Win32',
    toolset: 'v143',
    visualStudio,
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
    ...overrides
  };
}

export async function createFakeVisualStudio(workspace, toolsets = ['v143', 'v142'], options = {}) {
  const installationPath = path.join(workspace, 'fake-vs', '2022', 'Community');
  const platformToolsetsPath = path.join(installationPath, 'MSBuild', 'Microsoft', 'VC', 'v170', 'Platforms', 'Win32', 'PlatformToolsets');
  await fs.mkdir(platformToolsetsPath, { recursive: true });
  for (const toolset of toolsets) {
    const dir = path.join(platformToolsetsPath, toolset);
    await fs.mkdir(dir, { recursive: true });
    if (!options.missingProps?.includes(toolset)) {
      await fs.writeFile(path.join(dir, 'Toolset.props'), '');
    }
  }
  return {
    root: path.join(workspace, 'fake-vs'),
    installationPath,
    platformToolsetsPath
  };
}

export function makeVisualStudio(installationPath, detectedToolsets = ['v143', 'v142']) {
  return {
    version: '17',
    displayName: 'Visual Studio 2022 Community',
    installationPath,
    vcTargetsPath: path.join(installationPath, 'MSBuild', 'Microsoft', 'VC', 'v170'),
    platformToolsetsPath: path.join(installationPath, 'MSBuild', 'Microsoft', 'VC', 'v170', 'Platforms', 'Win32', 'PlatformToolsets'),
    detectedToolsets,
    detectedAt: '2026-06-22T00:00:00.000Z'
  };
}
