import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const fixtureId = 'G-TESTONLY01';
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path)); else result.push(path);
  }
  return result;
}
const run = (args, env = process.env) => execFileSync(process.execPath, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
const forbidden = /googletagmanager\.com|google-analytics\.com|posthog\.com|sidekick\.site\.analytics|G-TESTONLY01|phc_OFFLINE_TEST_FIXTURE_ONLY/;

test('configured site contains GA only while default build needs no ID, and standalone package/React ZIP never contains analytics', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'sidekick-analytics-build-')); t.after(() => rm(temporary, { recursive: true, force: true }));
  const clean = { ...process.env, npm_config_cache: join(temporary, 'npm-cache') }; delete clean.VITE_GA_MEASUREMENT_ID; delete clean.VITE_GA_ENABLED; delete clean.VITE_POSTHOG_TOKEN; delete clean.VITE_POSTHOG_ENABLED; delete clean.VITE_POSTHOG_HOST;
  const build = (directory, env) => run(['node_modules/vite/bin/vite.js', 'build', '--outDir', directory, '--emptyOutDir'], env);
  const off = join(temporary, 'off'); build(off, clean);
  const offText = (await Promise.all((await files(off)).filter(path => path.endsWith('.js')).map(path => readFile(path, 'utf8')))).join('\n');
  assert.equal(offText.includes(fixtureId), false);
  const on = join(temporary, 'on'); build(on, { ...clean, VITE_GA_MEASUREMENT_ID: fixtureId, VITE_GA_ENABLED: 'true' });
  const onText = (await Promise.all((await files(on)).filter(path => path.endsWith('.js')).map(path => readFile(path, 'utf8')))).join('\n');
  assert.ok(onText.includes(fixtureId)); assert.doesNotMatch(onText, /posthog|phc_/i); assert.ok(onText.includes('googletagmanager.com'));
  assert.ok(onText.includes('ga-disable-'));
  // Build package with the same env present: this must not affect any consumer bundle.
  const configured = { ...clean, VITE_GA_MEASUREMENT_ID: fixtureId, VITE_GA_ENABLED: 'true' };
  run(['scripts/build-library.mjs'], configured);
  for (const directory of ['dist/library', 'dist/browser']) {
    for (const path of await files(join(root, directory))) assert.doesNotMatch(await readFile(path, 'utf8'), forbidden, path);
  }
  run(['scripts/package-release.mjs'], configured);
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const zip = join(root, 'release', `sidekick-browser-${manifest.version}.zip`);
  const zipNames = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(zipNames.includes('sidekick-react.js')); assert.ok(zipNames.includes('sidekick.js'));
  for (const name of zipNames.filter(name => /\.(js|mjs|html)$/.test(name))) assert.doesNotMatch(execFileSync('unzip', ['-p', zip, name], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }), forbidden, `ZIP ${name}`);
  const archive = `${manifest.name.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`;
  const tarNames = execFileSync('tar', ['-tzf', join(root, 'release', archive)], { encoding: 'utf8' });
  assert.doesNotMatch(tarNames, /playground\/|site-analytics/);
});
