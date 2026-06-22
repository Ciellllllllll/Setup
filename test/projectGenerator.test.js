import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateGslibProject } from '../src/projectGenerator.js';
import { createFakeGslib, createFakeVisualStudio, makeConfig, makeProfile } from '../test-support/helpers.js';
import { writeConfig } from '../src/config.js';

test('generates GSLIB Visual Studio project files', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  const fake = await createFakeGslib(workspace);
  await createFakeVisualStudio(workspace);
  const config = makeProfile(fake);

  const result = await generateGslibProject(['MyGame'], { cwd: workspace, config });
  const root = result.outputRoot;

  await assertFile(path.join(root, 'MyGame.sln'));
  await assertFile(path.join(root, 'MyGame.vcxproj'));
  await assertFile(path.join(root, 'MyGame.vcxproj.filters'));
  await assertFile(path.join(root, 'src', 'main.cpp'));
  await assertFile(path.join(root, '.gitignore'));

  const vcxproj = await fs.readFile(path.join(root, 'MyGame.vcxproj'), 'utf8');
  const sln = await fs.readFile(path.join(root, 'MyGame.sln'), 'utf8');
  const mainCpp = await fs.readFile(path.join(root, 'src', 'main.cpp'), 'utf8');
  const gitignore = await fs.readFile(path.join(root, '.gitignore'), 'utf8');
  assert.match(vcxproj, /Debug\|Win32/);
  assert.match(vcxproj, /Release\|Win32/);
  assert.match(vcxproj, /<PlatformToolset>v143<\/PlatformToolset>/);
  assert.match(vcxproj, /<CharacterSet>MultiByte<\/CharacterSet>/);
  assert.match(vcxproj, /AdditionalIncludeDirectories/);
  assert.match(vcxproj, /AdditionalLibraryDirectories/);
  assert.match(vcxproj, /<IncludePath>.*fake-gslib\\include;\$\(IncludePath\)<\/IncludePath>/);
  assert.match(vcxproj, /<LibraryPath>.*fake-gslib\\lib;\$\(LibraryPath\)<\/LibraryPath>/);
  assert.equal((vcxproj.match(/<AdditionalDependencies>%\(AdditionalDependencies\)<\/AdditionalDependencies>/g) || []).length, 2);
  assert.doesNotMatch(vcxproj, /gslib\.lib;%\(AdditionalDependencies\)|atls\.lib/);
  assert.match(vcxproj, /src\\main\.cpp/);
  assert.match(vcxproj, /PostBuildEvent/);
  assert.match(vcxproj, /<SubSystem>Windows<\/SubSystem>/);
  assert.match(vcxproj, /<EntryPointSymbol>mainCRTStartup<\/EntryPointSymbol>/);
  assert.equal((vcxproj.match(/<UseOfATL>false<\/UseOfATL>/g) || []).length, 4);
  assert.equal((vcxproj.match(/<UseOfMfc>false<\/UseOfMfc>/g) || []).length, 4);
  assert.match(vcxproj, /<PropertyGroup Condition="'\$\(Configuration\)\|\$\(Platform\)'=='Debug\|Win32'" Label="Configuration">[\s\S]*<UseOfATL>false<\/UseOfATL>[\s\S]*<UseOfMfc>false<\/UseOfMfc>[\s\S]*<\/PropertyGroup>/);
  assert.match(vcxproj, /<PropertyGroup Condition="'\$\(Configuration\)\|\$\(Platform\)'=='Release\|Win32'" Label="Configuration">[\s\S]*<UseOfATL>false<\/UseOfATL>[\s\S]*<UseOfMfc>false<\/UseOfMfc>[\s\S]*<\/PropertyGroup>/);
  assert.match(vcxproj, /<ImportGroup Label="PropertySheets" Condition="'\$\(Configuration\)\|\$\(Platform\)'=='Release\|Win32'">[\s\S]*<\/ImportGroup>\s*<PropertyGroup Condition="'\$\(Configuration\)\|\$\(Platform\)'=='Debug\|Win32'">[\s\S]*<UseOfATL>false<\/UseOfATL>[\s\S]*<UseOfMfc>false<\/UseOfMfc>[\s\S]*<IncludePath>[\s\S]*<\/IncludePath>[\s\S]*<LibraryPath>[\s\S]*<\/LibraryPath>[\s\S]*<\/PropertyGroup>/);
  assert.doesNotMatch(vcxproj, /<UseOfATL>Static<\/UseOfATL>|<UseOfATL>Dynamic<\/UseOfATL>|<UseOfATL>true<\/UseOfATL>/);
  assert.doesNotMatch(vcxproj, /<UseOfMfc>Static<\/UseOfMfc>|<UseOfMfc>Dynamic<\/UseOfMfc>/);
  assert.doesNotMatch(vcxproj, /<SubSystem>Console<\/SubSystem>/);
  assert.doesNotMatch(vcxproj, /WinMainCRTStartup|wWinMainCRTStartup/);
  assert.doesNotMatch(vcxproj, /x64/);
  assert.doesNotMatch(vcxproj, /<ProjectConfiguration Include="Debug\|x86">|<ProjectConfiguration Include="Release\|x86">/);
  assert.doesNotMatch(vcxproj, /<ProjectConfiguration Include="Debug\|x64">|<ProjectConfiguration Include="Release\|x64">/);
  assert.match(sln, /Debug\|x86 = Debug\|x86/);
  assert.match(sln, /Release\|x86 = Release\|x86/);
  assert.match(sln, /Debug\|x64 = Debug\|x64/);
  assert.match(sln, /Release\|x64 = Release\|x64/);
  assert.ok(sln.indexOf('Debug|x86 = Debug|x86') < sln.indexOf('Debug|x64 = Debug|x64'));
  assert.match(sln, /GlobalSection\(SolutionConfigurationPlatforms\) = preSolution\r?\n\t\tDebug\|x86 = Debug\|x86\r?\n\t\tRelease\|x86 = Release\|x86\r?\n\t\tDebug\|x64 = Debug\|x64\r?\n\t\tRelease\|x64 = Release\|x64/);
  assert.match(sln, /\.Debug\|x86\.ActiveCfg = Debug\|Win32/);
  assert.match(sln, /\.Debug\|x86\.Build\.0 = Debug\|Win32/);
  assert.match(sln, /\.Release\|x86\.ActiveCfg = Release\|Win32/);
  assert.match(sln, /\.Release\|x86\.Build\.0 = Release\|Win32/);
  assert.match(sln, /\.Debug\|x64\.ActiveCfg = Debug\|Win32/);
  assert.match(sln, /\.Release\|x64\.ActiveCfg = Release\|Win32/);
  assert.doesNotMatch(sln, /\.Debug\|x64\.Build\.0|\.Release\|x64\.Build\.0/);
  assert.match(mainCpp, /#include <GSgame\.h>/);
  assert.match(mainCpp, /class MyGame : public gslib::Game/);
  assert.match(mainCpp, /return MyGame\(\)\.run\(\);/);
  assert.doesNotMatch(mainCpp, /#include <iostream>|std::cout|TODO|GSLIB project started/);
  assert.match(gitignore, /^\.vs\/$/m);
});

test('generates default project name from date', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  const fake = await createFakeGslib(workspace);
  await createFakeVisualStudio(workspace);
  const config = makeProfile(fake);

  const result = await generateGslibProject([], {
    cwd: workspace,
    config,
    now: new Date(2026, 5, 22)
  });

  assert.equal(path.basename(result.outputRoot), '06_22_26_Project');
  await assertFile(path.join(result.outputRoot, '06_22_26_Project.sln'));
  await assertFile(path.join(result.outputRoot, 'GSLIB_Project.vcxproj'));
});

test('does not overwrite an existing output directory', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  const fake = await createFakeGslib(workspace);
  await createFakeVisualStudio(workspace);
  const config = makeProfile(fake);
  const target = path.join(workspace, 'MyGame');
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'sentinel.txt'), 'keep');

  await assert.rejects(
    () => generateGslibProject(['MyGame'], { cwd: workspace, config }),
    /Directory already exists/
  );
  assert.equal(await fs.readFile(path.join(target, 'sentinel.txt'), 'utf8'), 'keep');
});

test('generates project using saved active JSON profile', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  process.env.USERPROFILE = path.join(workspace, 'home');
  const fake = await createFakeGslib(workspace);
  await createFakeVisualStudio(workspace);
  await writeConfig(makeConfig({ default: makeProfile(fake) }));

  const result = await generateGslibProject(['JsonConfigTest'], { cwd: workspace });
  const vcxproj = await fs.readFile(path.join(result.outputRoot, 'JsonConfigTest.vcxproj'), 'utf8');

  assert.match(vcxproj, /JsonConfigTest/);
  assert.match(vcxproj, /fake-gslib\\include/);
  assert.match(vcxproj, /fake-gslib\\lib/);
  assert.match(vcxproj, /<AdditionalDependencies>%\(AdditionalDependencies\)<\/AdditionalDependencies>/);
  assert.doesNotMatch(vcxproj, /gslib\.lib;%\(AdditionalDependencies\)|atls\.lib/);
});

test('generates vcxproj using saved dynamic toolset', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  const fake = await createFakeGslib(workspace);
  await createFakeVisualStudio(workspace, ['v142']);
  const config = makeProfile(fake, { toolset: 'v142', visualStudio: undefined });

  const result = await generateGslibProject(['ToolsetProject'], { cwd: workspace, config });
  const vcxproj = await fs.readFile(path.join(result.outputRoot, 'ToolsetProject.vcxproj'), 'utf8');

  assert.match(vcxproj, /<PlatformToolset>v142<\/PlatformToolset>/);
  assert.doesNotMatch(vcxproj, /<PlatformToolset>v143<\/PlatformToolset>/);
});

test('templates use GSgame main.cpp and Windows subsystem', async () => {
  const mainTemplate = await fs.readFile(path.resolve('templates/gslib/main.cpp.tpl'), 'utf8');
  const vcxprojTemplate = await fs.readFile(path.resolve('templates/gslib/vcxproj.tpl'), 'utf8');
  const slnTemplate = await fs.readFile(path.resolve('templates/gslib/sln.tpl'), 'utf8');

  assert.match(mainTemplate, /#include <GSgame\.h>/);
  assert.match(mainTemplate, /class MyGame : public gslib::Game/);
  assert.match(mainTemplate, /return MyGame\(\)\.run\(\);/);
  assert.doesNotMatch(mainTemplate, /#include <iostream>|std::cout|TODO|GSLIB project started/);
  assert.match(vcxprojTemplate, /<SubSystem>Windows<\/SubSystem>/);
  assert.match(vcxprojTemplate, /<EntryPointSymbol>mainCRTStartup<\/EntryPointSymbol>/);
  assert.match(vcxprojTemplate, /<UseOfATL>false<\/UseOfATL>/);
  assert.match(vcxprojTemplate, /<UseOfMfc>false<\/UseOfMfc>/);
  assert.match(vcxprojTemplate, /<IncludePath>__INCLUDE_DIR__;\$\(IncludePath\)<\/IncludePath>/);
  assert.match(vcxprojTemplate, /<LibraryPath>__LIB_DIR__;\$\(LibraryPath\)<\/LibraryPath>/);
  assert.match(vcxprojTemplate, /<AdditionalDependencies>__ADDITIONAL_DEPENDENCIES__<\/AdditionalDependencies>/);
  assert.equal((vcxprojTemplate.match(/<UseOfATL>false<\/UseOfATL>/g) || []).length, 4);
  assert.equal((vcxprojTemplate.match(/<UseOfMfc>false<\/UseOfMfc>/g) || []).length, 4);
  assert.doesNotMatch(vcxprojTemplate, /<SubSystem>Console<\/SubSystem>/);
  assert.doesNotMatch(vcxprojTemplate, /<UseOfATL>Static<\/UseOfATL>|<UseOfATL>Dynamic<\/UseOfATL>|<UseOfATL>true<\/UseOfATL>/);
  assert.doesNotMatch(vcxprojTemplate, /<UseOfMfc>Static<\/UseOfMfc>|<UseOfMfc>Dynamic<\/UseOfMfc>/);
  assert.match(slnTemplate, /Debug\|x86 = Debug\|x86/);
  assert.match(slnTemplate, /Release\|x86 = Release\|x86/);
  assert.match(slnTemplate, /Debug\|x64 = Debug\|x64/);
  assert.match(slnTemplate, /Release\|x64 = Release\|x64/);
  assert.ok(slnTemplate.indexOf('Debug|x86 = Debug|x86') < slnTemplate.indexOf('Debug|x64 = Debug|x64'));
  assert.doesNotMatch(slnTemplate, /Debug\|x64\.Build\.0|Release\|x64\.Build\.0/);
});

async function assertFile(file) {
  assert.equal((await fs.stat(file)).isFile(), true, file);
}
