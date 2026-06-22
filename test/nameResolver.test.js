import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProjectNames } from '../src/nameResolver.js';

test('resolves default project names', () => {
  assert.deepEqual(resolveProjectNames([], new Date(2026, 5, 22)), {
    solutionName: '06_22_26_Project',
    projectName: 'GSLIB_Project',
    windowTitle: 'GameWindow'
  });
});

test('resolves direct name', () => {
  assert.deepEqual(resolveProjectNames(['MyGame']), {
    solutionName: 'MyGame',
    projectName: 'MyGame',
    windowTitle: 'MyGame'
  });
});

test('resolves -- name form', () => {
  assert.deepEqual(resolveProjectNames(['--', 'MyGame']), {
    solutionName: 'MyGame',
    projectName: 'MyGame',
    windowTitle: 'MyGame'
  });
});

test('resolves --Name form', () => {
  assert.deepEqual(resolveProjectNames(['--MyGame']), {
    solutionName: 'MyGame',
    projectName: 'MyGame',
    windowTitle: 'MyGame'
  });
});

test('normalizes hyphen for project name', () => {
  assert.deepEqual(resolveProjectNames(['My-Game']), {
    solutionName: 'My-Game',
    projectName: 'My_Game',
    windowTitle: 'My-Game'
  });
});

test('allows spaces and normalizes them for project name', () => {
  assert.deepEqual(resolveProjectNames(['My Game']), {
    solutionName: 'My Game',
    projectName: 'My_Game',
    windowTitle: 'My Game'
  });
});

test('rejects unsafe project names', () => {
  assert.throws(() => resolveProjectNames(['../Game']), /Invalid project name/);
  assert.throws(() => resolveProjectNames(['Game;Remove-Item']), /Invalid project name/);
  assert.throws(() => resolveProjectNames(['C:\\Game']), /Invalid project name/);
  assert.throws(() => resolveProjectNames(['Game/Stage']), /Invalid project name/);
});
