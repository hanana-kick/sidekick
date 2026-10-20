import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('source development uses Node 24 without imposing a Node engine on browser consumers', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  assert.equal((await read('.nvmrc')).trim(), '24');
  assert.deepEqual(manifest.devEngines.runtime, { name: 'node', version: '>=24 <25', onFail: 'error' });
  assert.equal(manifest.engines, undefined);
  assert.match(manifest.devDependencies['@types/node'], /^24\./);
  assert.equal(lock.packages[''].engines, undefined);
  assert.equal(lock.packages[''].version, manifest.version);
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
  for (const file of ['README.md', 'README.en.md', 'README.ja.md', 'README.zh-CN.md']) {
    const source = await read(file);
    assert.match(source, /Node\.js 24 LTS/, file);
    assert.doesNotMatch(source, /Node\.js 22/, file);
  }
});

test('every CI workflow shares the development version and Node 24-native Actions', async () => {
  // These official releases declare runs.using: node24. upload-pages-artifact
  // is composite and delegates to Node 24-native upload-artifact v7.0.0.
  const actions = new Map(Object.entries({
    checkout: '7.0.1', 'setup-node': '7.1.0', 'upload-artifact': '7.0.2',
    'configure-pages': '6.0.0', 'upload-pages-artifact': '5.0.0', 'deploy-pages': '5.0.1',
  }));
  const workflows = await readdir(new URL('.github/workflows/', root));
  let setups = 0;
  for (const file of workflows.filter(name => /\.ya?ml$/.test(name))) {
    const source = await read(`.github/workflows/${file}`);
    const setupCount = [...source.matchAll(/uses: actions\/setup-node@/g)].length;
    assert.equal([...source.matchAll(/node-version-file: \.nvmrc/g)].length, setupCount, file);
    assert.doesNotMatch(source, /\bnode-version:/, file);
    assert.doesNotMatch(source, /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24|ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION/, file);
    for (const [, action, version] of source.matchAll(/uses: actions\/([\w-]+)@v([\d.]+)/g)) {
      assert.equal(version, actions.get(action), `${file}: ${action} must use a verified Node 24 release`);
    }
    setups += setupCount;
  }
  // One additional setup belongs to the independent browser matrix job.
  assert.equal(setups, 8);
});


test('independent browser groups retain all suites and mandatory unit/isolation gates', async () => {
  const source = await read('.github/workflows/ci.yml');
  const manifest = JSON.parse(await read('package.json'));
  assert.match(source, /needs: test/);
  assert.match(source, /fail-fast: false/);
  assert.match(source, /suite: \[reference, regression, canvas-interactions\]/);
  for (const suite of ['reference', 'regression', 'canvas-interactions']) assert.ok(manifest.scripts[`test:browser:${suite}`]);
  assert.match(source, /run: npm test/);
  assert.match(source, /run: npm run test:site-analytics:build/);
  assert.match(source, /run: xvfb-run -a npm run test:browser:\$\{\{ matrix\.suite \}\}/);
  assert.doesNotMatch(source, /continue-on-error/);
  assert.match(manifest.scripts['test:browser:canvas-interactions'], /SIDEKICK_FORCE_CANVAS2D=1.*state-reference-browser.*size-browser/);
  assert.match(manifest.scripts['test:browser:canvas-interactions'], /live viewport resize.*api-playground-browser/);
});
