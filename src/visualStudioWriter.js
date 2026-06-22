import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { toWindowsPath, xmlEscape } from './pathUtils.js';

export function newGuid() {
  return `{${crypto.randomUUID().toUpperCase()}}`;
}

export async function renderTemplate(templatePath, targetPath, values) {
  const template = await fs.readFile(templatePath, 'utf8');
  let rendered = template;
  for (const [key, value] of Object.entries(values)) {
    rendered = rendered.replaceAll(`__${key}__`, value);
  }
  await fs.writeFile(targetPath, rendered, 'utf8');
}

export function templateValues({ names, config, projectGuid, solutionGuid }) {
  const binDir = config.binDir || '';
  return {
    SOLUTION_NAME: names.solutionName,
    PROJECT_NAME: names.projectName,
    PROJECT_GUID: projectGuid,
    SOLUTION_GUID: solutionGuid,
    INCLUDE_DIR: xmlEscape(toWindowsPath(config.includeDir)),
    LIB_DIR: xmlEscape(toWindowsPath(config.libDir)),
    TOOLSET: xmlEscape(config.toolset),
    ADDITIONAL_DEPENDENCIES: '%(AdditionalDependencies)',
    POST_BUILD_COMMAND: xmlEscape(config.binDir ? `if exist "${toWindowsPath(config.binDir)}\\*.dll" xcopy /Y /D "${toWindowsPath(config.binDir)}\\*.dll" "$(OutDir)"` : '')
  };
}

export function templateDir() {
  return path.resolve(fileURLToPath(new URL('../templates/gslib', import.meta.url)));
}
