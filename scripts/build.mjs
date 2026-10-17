import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
// Clean once, then preserve native library modules/declarations alongside Studio assets.
rmSync('dist', { recursive: true, force: true });
execFileSync(process.execPath, ['scripts/build-library.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit' });
cpSync('third_party/material-shapes', 'dist/third_party/material-shapes', { recursive: true });
mkdirSync('dist/third_party/shadcn-ui', { recursive: true });
copyFileSync('playground/components/ui/LICENSE.md', 'dist/third_party/shadcn-ui/LICENSE.md');
