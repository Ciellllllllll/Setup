import { readConfig, validateSavedProfile, writeConfig } from './config.js';
import { detectVisualStudioToolsets } from './toolsetDetector.js';

export async function listToolsets(options = {}) {
  const detected = await detectVisualStudioToolsets(options);
  console.log('Visual Studio C++ PlatformToolsets:\n');
  console.log(detected.visualStudio.displayName);
  console.log(`  path: ${detected.visualStudio.installationPath}`);
  console.log('  platform: Win32');
  console.log('  toolsets:');
  for (const toolset of detected.visualStudio.detectedToolsets) console.log(`    ${toolset}`);

  try {
    const config = await readConfig();
    const profile = config.activeProfile ? config.profiles[config.activeProfile] : null;
    console.log('\nActive profile:');
    console.log(`  ${config.activeProfile || 'none'}\n`);
    console.log('Active toolset:');
    console.log(`  ${profile?.toolset || 'none'}`);
  } catch {
    console.log('\nActive profile:');
    console.log('  none\n');
    console.log('Active toolset:');
    console.log('  none');
  }
}

export async function useToolset(toolset, options = {}) {
  const config = await readConfig();
  const profileName = config.activeProfile;
  const profile = profileName ? config.profiles[profileName] : null;
  if (!profile) throw new Error('GSLIB is not configured.\n\nRun:\n  Setup --find');

  const detected = await detectVisualStudioToolsets({ ...options, requestedToolset: toolset });
  profile.toolset = toolset;
  profile.visualStudio = detected.visualStudio;
  profile.updatedAt = (options.now || new Date()).toISOString();
  await validateSavedProfile(profileName, profile);
  await writeConfig(config);

  console.log('Active profile toolset changed:');
  console.log(`  profile: ${profileName}`);
  console.log(`  toolset: ${toolset}`);
}
