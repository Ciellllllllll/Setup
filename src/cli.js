import { findAndSaveGslib } from './gslibFinder.js';
import { generateGslibProject } from './projectGenerator.js';
import { showConfig, listProfiles, useProfile, removeProfile, doctor } from './configCommands.js';
import { configPath } from './config.js';
import { uninstallSetup } from './uninstall.js';
import { listToolsets, useToolset } from './toolsetCommands.js';
import { readPackageInfo } from './packageInfo.js';
import { runAutomaticUpdateCheck, runManualUpdateCheck } from './updateChecker.js';

export async function run(args, options = {}) {
  args = normalizeHyphens(args);

  if (args[0] === '--update-check') {
    await runManualUpdateCheck({ ...options.updateCheck, force: args.includes('--force') });
    return;
  }

  if (args[0] === 'update') {
    await runManualUpdateCheck({ ...options.updateCheck, force: true });
    return;
  }

  if (isUninstallCommand(args)) {
    await uninstallSetup({
      ...options.uninstall,
      force: args.includes('--force'),
      keepConfig: args.includes('--keep-config')
    });
    return;
  }

  if (shouldRunAutomaticUpdateCheck(args)) {
    await (options.runAutomaticUpdateCheck || runAutomaticUpdateCheck)(options.updateCheck || {});
  }

  if (args.length === 0) {
    await generateGslibProject([]);
    return;
  }

  if (args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    console.log((await readPackageInfo()).currentVersion);
    return;
  }

  if (args[0] === '--config') {
    await showConfig();
    return;
  }

  if (args[0] === '--config-path') {
    console.log(configPath());
    return;
  }

  if (args[0] === '--toolsets') {
    await listToolsets();
    return;
  }

  if (args[0] === '--toolset') {
    if (!args[1]) throw new Error('Missing toolset.\n\nRun:\n  Setup --toolsets');
    await useToolset(args[1]);
    return;
  }

  if (args[0] === '--find') {
    await findAndSaveGslib(firstValueAfter(args, '--find'), {
      profileName: optionValue(args, '--as') || 'default',
      requestedToolset: optionValue(args, '--toolset')
    });
    return;
  }

  if (args[0] === '--list') {
    await listProfiles();
    return;
  }

  if (args[0] === '--use') {
    if (!args[1]) throw new Error('Missing profile.\n\nRun:\n  Setup --list');
    await useProfile(args[1]);
    return;
  }

  if (args[0] === '--remove') {
    if (!args[1]) throw new Error('Missing profile.\n\nRun:\n  Setup --list');
    await removeProfile(args[1], { force: args.includes('--force') });
    return;
  }

  if (args[0] === '--doctor') {
    await doctor();
    return;
  }

  if (args[0] === 'gslib') {
    throw removedCommandError('Setup --find');
  }

  if (args[0] === 'Make') {
    throw removedCommandError('Setup');
  }

  if (args[0] === 'config' || args[0] === 'toolset') {
    throw removedCommandError(args[0] === 'config' ? 'Setup --config' : 'Setup --toolsets');
  }

  await generateGslibProject(projectNameArgs(args));
}

function projectNameArgs(args) {
  if (args[0] === '--') {
    if (!args[1]) throw new Error('Missing project name.\n\nRun:\n  Setup --help');
    return args.slice(0, 2);
  }
  if (args[0] === '--name') {
    if (!args[1]) throw new Error('Missing project name.\n\nRun:\n  Setup --help');
    return args.slice(0, 2);
  }
  if (args[0]?.startsWith('--')) {
    throw new Error(`Unknown option: ${args[0]}\n\nRun:\n  Setup --help`);
  }
  return [args[0]];
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function firstValueAfter(args, name) {
  const index = args.indexOf(name);
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

function normalizeHyphens(args) {
  return args.map((arg) => arg.replaceAll(/[‐‒–—−]/g, '-'));
}

function isUninstallCommand(args) {
  return args[0] === '--uninstall' || args[0]?.toLowerCase() === 'uninstall' || (args[0] === '--' && args[1]?.toLowerCase() === 'uninstall');
}

function removedCommandError(replacement) {
  return new Error(`This command style has been removed.\n\nUse:\n  ${replacement}`);
}

function printHelp() {
  console.log(`Setup - GSLIB project generator

Usage:
  Setup
  Setup "<name>"
  Setup --name "<name>"
  Setup --find [path] [--as profile] [--toolset toolset]
  Setup --list
  Setup --use <profile>
  Setup --remove <profile> [--force]
  Setup --doctor
  Setup --config
  Setup --config-path
  Setup --toolsets
  Setup --toolset <toolset>
  Setup update [--force]
  Setup --update-check [--force]
  Setup --uninstall [--force] [--keep-config]
  Setup uninstall [--force] [--keep-config]
  Setup --help
  Setup --version`);
}

export function shouldRunAutomaticUpdateCheck(args) {
  const excluded = new Set(['--config-path', '--version', '-v', '--help', '-h', '--uninstall', '--update-check', 'update']);
  return !excluded.has(args[0]);
}
