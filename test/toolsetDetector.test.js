import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectVisualStudioToolsets } from '../src/toolsetDetector.js';
import { createFakeVisualStudio } from '../test-support/helpers.js';

test('selects v143 when v143 and v142 are available', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  const vs = await createFakeVisualStudio(workspace, ['v143', 'v142']);

  const detected = await detectVisualStudioToolsets({ candidateRoots: [vs.root], skipVswhere: true });

  assert.equal(detected.selectedToolset, 'v143');
  assert.deepEqual(detected.visualStudio.detectedToolsets, ['v143', 'v142']);
});

test('selects v142 when v143 is unavailable', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  const vs = await createFakeVisualStudio(workspace, ['v142']);

  const detected = await detectVisualStudioToolsets({ candidateRoots: [vs.root], skipVswhere: true });

  assert.equal(detected.selectedToolset, 'v142');
  assert.deepEqual(detected.visualStudio.detectedToolsets, ['v142']);
});

test('ignores toolset directories without Toolset.props', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  const vs = await createFakeVisualStudio(workspace, ['v143', 'v142'], { missingProps: ['v143'] });

  const detected = await detectVisualStudioToolsets({ candidateRoots: [vs.root], skipVswhere: true });

  assert.equal(detected.selectedToolset, 'v142');
  assert.deepEqual(detected.visualStudio.detectedToolsets, ['v142']);
});

test('throws when no toolsets are available', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  const vs = await createFakeVisualStudio(workspace, []);
  await fs.mkdir(vs.platformToolsetsPath, { recursive: true });

  await assert.rejects(
    () => detectVisualStudioToolsets({ candidateRoots: [vs.root], skipVswhere: true }),
    /Visual Studio C\+\+ PlatformToolset was not found/
  );
});

test('throws when requested toolset is unavailable', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gslib-setup-'));
  const vs = await createFakeVisualStudio(workspace, ['v143', 'v142']);

  await assert.rejects(
    () => detectVisualStudioToolsets({ candidateRoots: [vs.root], requestedToolset: 'v141', skipVswhere: true }),
    /PlatformToolset is not available/
  );
});
