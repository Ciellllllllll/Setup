import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.js';
import { resolveProjectNames } from './nameResolver.js';
import { newGuid, renderTemplate, templateDir, templateValues } from './visualStudioWriter.js';

export async function generateGslibProject(args, options = {}) {
  const names = resolveProjectNames(args, options.now);
  const config = options.config || await loadConfig(options.profileName);
  const outputRoot = path.resolve(options.cwd || process.cwd(), names.solutionName);

  try {
    await fs.mkdir(outputRoot);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Directory already exists: ${outputRoot}`);
    throw error;
  }

  await fs.mkdir(path.join(outputRoot, 'src'));
  const values = templateValues({
    names,
    config,
    projectGuid: newGuid(),
    solutionGuid: newGuid()
  });
  const templates = templateDir();

  await renderTemplate(path.join(templates, 'sln.tpl'), path.join(outputRoot, `${names.solutionName}.sln`), values);
  await renderTemplate(path.join(templates, 'vcxproj.tpl'), path.join(outputRoot, `${names.projectName}.vcxproj`), values);
  await renderTemplate(path.join(templates, 'vcxproj.filters.tpl'), path.join(outputRoot, `${names.projectName}.vcxproj.filters`), values);
  await renderTemplate(path.join(templates, 'main.cpp.tpl'), path.join(outputRoot, 'src', 'main.cpp'), values);
  await fs.writeFile(path.join(outputRoot, '.gitignore'), '.vs/\nDebug/\nRelease/\n*.user\n*.suo\n*.VC.db\n*.VC.VC.opendb\n', 'utf8');

  console.log('Created GSLIB project.\n');
  console.log(`Solution:\n  ${path.join(outputRoot, `${names.solutionName}.sln`)}\n`);
  console.log(`Project:\n  ${path.join(outputRoot, `${names.projectName}.vcxproj`)}\n`);
  console.log(`Platform:\n  Visual Studio 2022 / Win32 / ${config.toolset}\n`);
  console.log('GSLIB:');
  console.log(`  include: ${config.includeDir}`);
  console.log(`  lib:     ${config.libDir}`);
  console.log(`  bin:     ${config.binDir || 'none'}`);

  return { outputRoot, names };
}
