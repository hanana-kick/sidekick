import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBrowser } from './build-browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const checking = process.argv.includes('--check');
const temporary = checking ? mkdtempSync(join(tmpdir(), 'sidekick-library-check-')) : undefined;
const outputRoot = temporary ?? resolve(root, 'dist');
const output = join(outputRoot, 'library');
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }).sort();
}
try {
  if (!checking) rmSync(output, { recursive: true, force: true });
  execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', resolve(root, 'tsconfig.library.json'), '--outDir', output], { cwd: root, stdio: 'inherit' });
  await buildBrowser({ libraryDirectory: output, outputDirectory: join(outputRoot, 'browser') });
  if (checking) {
    const committed = resolve(root, 'dist');
    const generated = ['library', 'browser'].flatMap(directory => files(join(outputRoot, directory)).map(path => relative(outputRoot, path)));
    let existing = [];
    try { existing = ['library', 'browser'].flatMap(directory => files(join(committed, directory)).map(path => relative(committed, path))); } catch { /* Report missing artifacts as stale. */ }
    const changed = [...new Set([...generated, ...existing])].filter(path => {
      try { return !readFileSync(join(outputRoot, path)).equals(readFileSync(join(committed, path))); } catch { return true; }
    });
    if (changed.length) throw new Error(`dist/library or dist/browser is stale. Run npm run build:library and commit the result.\n${changed.join('\n')}`);
    console.log(`Library and browser artifacts match source (${generated.length} files).`);
  } else console.log(`Built ${files(output).length} library modules/declarations and ${files(join(outputRoot, 'browser')).length} prebuilt browser files.`);
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
