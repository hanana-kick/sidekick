import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const checking = process.argv.includes('--check');
const temporary = checking ? mkdtempSync(join(tmpdir(), 'sidekick-library-check-')) : undefined;
const output = temporary ? join(temporary, 'library') : resolve(root, 'dist/library');
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }).sort();
}
try {
  if (!checking) rmSync(output, { recursive: true, force: true });
  execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', resolve(root, 'tsconfig.library.json'), '--outDir', output], { cwd: root, stdio: 'inherit' });
  if (checking) {
    const committed = resolve(root, 'dist/library');
    const generated = files(output).map(path => relative(output, path));
    let existing = [];
    try { existing = files(committed).map(path => relative(committed, path)); } catch { /* Report missing artifacts as stale. */ }
    const changed = [...new Set([...generated, ...existing])].filter(path => {
      try { return !readFileSync(join(output, path)).equals(readFileSync(join(committed, path))); } catch { return true; }
    });
    if (changed.length) throw new Error(`dist/library is stale. Run npm run build:library and commit the result.\n${changed.join('\n')}`);
    console.log(`Library artifacts match source (${generated.length} files).`);
  } else console.log(`Built ${files(output).length} library modules/declarations in dist/library.`);
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
