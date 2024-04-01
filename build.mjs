#! /usr/bin/env node

import { writeFileSync } from 'fs';

import { context, build } from 'esbuild';

const buildOptions = {
  entryPoints: ['./src/**/*'],
  globalName: 'halvingmassacre',
  logLevel: 'debug',
  metafile: true,
  platform: 'node',
  sourcemap: 'linked',
  sourcesContent: false,
  tsconfig: './tsconfig.build.json',
  format: 'esm',
  outdir: './dist',
  outExtension: { '.js': '.mjs' },
  packages: 'external',
  bundle: true,
};

for (const arg of process.argv) {
  switch (arg) {
    case '-w':
    case '--watch':
      const ctx = await context(buildOptions);
      await ctx.watch();
      break;
    default:
      const res = await build(buildOptions);
      writeFileSync('./dist/meta.json', JSON.stringify(res.metafile));
  }
}
