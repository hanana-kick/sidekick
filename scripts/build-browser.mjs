import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Prebuilt distributions. React is external and its renderer stays lazy for SSR. */
export async function buildBrowser({ libraryDirectory = resolve(root, 'dist/library'), outputDirectory = resolve(root, 'dist/browser') } = {}) {
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const notice = readFileSync(join(root, 'third_party/material-shapes/NOTICE'), 'utf8');
  const license = readFileSync(join(root, 'third_party/material-shapes/LICENSE'), 'utf8');
  const header = `/*! Sidekick ${version} | UNLICENSED; no license is granted for Sidekick itself.\n\nThird-party Material Shapes notices and Apache-2.0 license:\n${notice}\n${license}\n*/`;
  const common = { minify: true, comments: false, sourcemap: false, postBanner: header };
  const vanilla = await rolldown({ input: join(libraryDirectory, 'auto.js'), platform: 'browser', preserveEntrySignatures: 'strict' });
  try {
    await vanilla.write({ ...common, format: 'esm', file: join(outputDirectory, 'sidekick.js'), codeSplitting: false });
    await vanilla.write({ ...common, format: 'iife', name: 'Sidekick', file: join(outputDirectory, 'sidekick.iife.js'), codeSplitting: false });
  } finally { await vanilla.close(); }
  const react = await rolldown({
    input: join(libraryDirectory, 'react.js'), platform: 'browser', external: ['react'], preserveEntrySignatures: 'strict',
    onwarn(warning, warn) { if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning); },
  });
  try {
    await react.write({
      ...common, format: 'esm', dir: outputDirectory,
      entryFileNames: 'sidekick-react.js', chunkFileNames: 'sidekick-element.js',
      postBanner: chunk => `${chunk.isEntry ? "'use client';\n" : ''}${header}`,
    });
  } finally { await react.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildBrowser();
