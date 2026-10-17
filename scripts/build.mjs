import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'inherit' });
mkdirSync('dist/playground', { recursive: true });
for (const file of ['index.html', 'style.css']) {
  copyFileSync(`playground/${file}`, `dist/playground/${file}`);
}
