import { assertSafePathName } from './pathUtils.js';

export function resolveProjectNames(args, now = new Date()) {
  const rawName = parseName(args);
  if (!rawName) {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    return {
      solutionName: `${month}_${day}_${year}_Project`,
      projectName: 'GSLIB_Project',
      windowTitle: 'GameWindow'
    };
  }

  assertSafePathName(rawName);
  return {
    solutionName: rawName,
    projectName: rawName.replaceAll(/[- ]/g, '_'),
    windowTitle: rawName
  };
}

function parseName(args) {
  if (args.length === 0) return null;
  if (args[0] === '--') return args[1] || null;
  if (args[0] === '--name') return args[1] || null;
  if (args[0].startsWith('--') && args[0].length > 2) return args[0].slice(2);
  return args[0];
}
