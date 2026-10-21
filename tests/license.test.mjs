import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPackageConsumer } from './package-fixture.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const browserFiles = ['sidekick.js', 'sidekick.iife.js', 'sidekick-react.js', 'sidekick-element.js', 'sidekick-fallback.js', 'sidekick.worker.js'];

test('custom license is consistent and accompanies actual packed distributions', t => {
  const consumer = createPackageConsumer(); t.after(consumer.cleanup);
  const license = read('LICENSE');
  assert.equal(consumer.manifest.license, 'SEE LICENSE IN LICENSE');
  assert.equal(JSON.parse(read('package-lock.json')).packages[''].license, consumer.manifest.license);
  assert.equal(readFileSync(consumer.packagePath + '/LICENSE', 'utf8'), license);
  for (const file of browserFiles) {
    const bundle = readFileSync(consumer.packagePath + '/dist/browser/' + file, 'utf8');
    assert.ok(bundle.includes(license), file + ' must carry full terms even when copied alone');
    assert.ok(bundle.includes(read('third_party/material-shapes/LICENSE')));
    assert.ok(bundle.includes(read('third_party/material-shapes/NOTICE')));
    assert.ok(!bundle.includes('UNLICENSED; no license is granted'));
  }
  for (const file of ['README.md', 'README.en.md', 'README.ja.md', 'README.zh-CN.md']) {
    const text = readFileSync(consumer.packagePath + '/' + file, 'utf8');
    assert.match(text, /\[Sidekick Library and Character License 1\.0\]\(LICENSE\)/);
    assert.match(text, /SEE LICENSE IN LICENSE/);
    assert.ok(!text.includes('UNLICENSED'));
  }
  assert.match(license, /advertising-supported/);
  assert.match(license, /screenshots, recordings, documentation/);
  assert.match(license, /independently created user or third-party artwork/);
  assert.match(license, /does not withdraw, replace,/);
  assert.match(license, /not the MIT License or an OSI-approved/);
});
