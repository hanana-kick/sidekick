import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Test the actual release builder in a disposable clean repository, not just its
// source strings. Never changes the working checkout, remote, tags or registry.
test('browser ZIP and npm archive carry identical authoritative license and unchanged third-party notices', t => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const fixture = mkdtempSync(join(tmpdir(), 'sidekick-license-release-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  for (const file of ['LICENSE', '.gitignore', 'package.json', 'README.md', 'README.en.md', 'README.ja.md', 'README.zh-CN.md', 'dist/library', 'dist/browser', 'third_party', 'scripts/package-release.mjs', 'scripts/build-react-peers.mjs']) {
    cpSync(join(root, file), join(fixture, file), { recursive: true });
  }
  symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'junction');
  const run = (command, args) => execFileSync(command, args, { cwd: fixture, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, npm_config_cache: join(fixture, '.cache') } });
  run('git', ['init', '--quiet']);
  run('git', ['add', '.']);
  run('git', ['-c', 'user.name=License fixture', '-c', 'user.email=fixture@invalid.test', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Isolated release fixture']);
  const result = JSON.parse(run(process.execPath, ['scripts/package-release.mjs']));
  const archive = join(fixture, 'release', `sidekick-browser-${result.version}.zip`);
  const zipRead = file => run('unzip', ['-p', archive, file]);
  assert.equal(zipRead('LICENSE'), readFileSync(join(root, 'LICENSE'), 'utf8'));
  assert.equal(JSON.parse(zipRead('release.json')).license, 'SEE LICENSE IN LICENSE');
  assert.match(zipRead('START-HERE.txt'), /Preserve LICENSE and third-party notices/);
  for (const file of ['third_party/material-shapes/LICENSE', 'third_party/material-shapes/NOTICE']) {
    assert.equal(zipRead(file), readFileSync(join(root, file), 'utf8'));
  }
  for (const name of ['react', 'react-dom', 'scheduler']) assert.match(zipRead(`vendor/${name}-LICENSE.txt`), /MIT License/);
  const tarball = join(fixture, 'release', result.assets.find(file => file.endsWith('.tgz')));
  assert.equal(run('tar', ['-xOf', tarball, 'package/LICENSE']), zipRead('LICENSE'));
});
