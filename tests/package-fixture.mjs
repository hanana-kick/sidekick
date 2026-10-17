import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/** Real tarball installs, isolated from repository node_modules and registry access. */
export function createPackageConsumer({ react = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'sidekick-consumer-'));
  const tarballs = join(directory, 'tarballs');
  mkdirSync(tarballs);
  const runNpm = (args, cwd = directory) => execFileSync(npm, [...args, '--cache', join(directory, '.npm-cache'), '--no-audit', '--no-fund'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const pack = cwd => JSON.parse(runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', tarballs], cwd))[0];
  try {
    const packed = pack(root);
    const dependencies = { '@hanana-kick/sidekick': `file:${join(tarballs, packed.filename)}` };
    if (react) for (const name of ['react', 'react-dom', 'scheduler', '@types/react', '@types/react-dom', 'csstype']) {
      const dependency = pack(resolve(root, 'node_modules', name));
      dependencies[name] = `file:${join(tarballs, dependency.filename)}`;
    }
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'sidekick-consumer-check', private: true, type: 'module', dependencies }, null, 2));
    runNpm(['install', '--offline']);
    const packagePath = join(directory, 'node_modules/@hanana-kick/sidekick');
    return {
      directory, packagePath, packed,
      manifest: JSON.parse(readFileSync(join(packagePath, 'package.json'), 'utf8')),
      run: (args, options = {}) => execFileSync(process.execPath, args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }),
      cleanup: () => rmSync(directory, { recursive: true, force: true }),
    };
  } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
}
