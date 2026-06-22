#!/usr/bin/env node
import { run } from '../src/cli.js';

try {
  await run(process.argv.slice(2));
} catch (error) {
  console.error('[Setup Error]');
  console.error(error.message);
  process.exit(1);
}
