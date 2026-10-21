import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBrowser } from './build-browser.mjs';
import { buildPluginSdk } from './build-plugin-sdk.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const checking = process.argv.includes('--check');
const temporary = checking ? mkdtempSync(join(tmpdir(), 'sidekick-library-check-')) : undefined;
const outputRoot = resolve(temporary ?? root, 'dist');
const output = join(outputRoot, 'library');
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }).sort();
}
try {
  // Rolldown uses package.json sideEffects when inlining lazy modules. Keep
  // the same package-relative paths and metadata as the published build.
  if (temporary) copyFileSync(join(root, 'package.json'), join(temporary, 'package.json'));
  if (!checking) rmSync(output, { recursive: true, force: true });
  execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', resolve(root, 'tsconfig.library.json'), '--outDir', output], { cwd: root, stdio: 'inherit' });
  await buildBrowser({ libraryDirectory: output, outputDirectory: join(outputRoot, 'browser') });
  await buildPluginSdk({ libraryDirectory: output, outputDirectory: join(outputRoot, 'plugin-sdk') });
  if (checking) {
    const committed = resolve(root, 'dist');
    const generated = ['library', 'browser', 'plugin-sdk'].flatMap(directory => files(join(outputRoot, directory)).map(path => relative(outputRoot, path)));
    let existing = [];
    try { existing = ['library', 'browser', 'plugin-sdk'].flatMap(directory => files(join(committed, directory)).map(path => relative(committed, path))); } catch { /* Report missing artifacts as stale. */ }
    const changed = [...new Set([...generated, ...existing])].filter(path => {
      try { return !readFileSync(join(outputRoot, path)).equals(readFileSync(join(committed, path))); } catch { return true; }
    });
    if (changed.length) throw new Error(`dist/library, dist/browser or dist/plugin-sdk is stale. Run npm run build:library and commit the result.\n${changed.join('\n')}`);
    console.log(`Library, browser and plugin SDK artifacts match source (${generated.length} files).`);
  } else console.log(`Built ${files(output).length} library modules/declarations, ${files(join(outputRoot, 'browser')).length} prebuilt browser files and ${files(join(outputRoot, 'plugin-sdk')).length} plugin SDK files.`);
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
