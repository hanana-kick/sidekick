import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { referenceCSS, compileReferenceAttributes } from '../playground/state-reference-schema.js';
import { createScene } from '../src/core/scene.ts';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the page-owned API demo uses 115px without changing renderer defaults', async () => {
  assert.match(await read('playground/api-demo.js'), /bot\.setAttribute\('size','115'\)/);
  assert.doesNotMatch(await read('playground/api-demo.css'), /#bot\{[^}]*width:/);
  assert.match(await read('playground/api-playground.js'), /placement="viewport" size="115"/);
});
test('general Guide previews are 115px but lesson-specific and explicit sizes are unchanged', () => {
  assert.match(referenceCSS('state-emotion'), /#reference-bot\{width:115px;height:115px;margin:0\}/);
  assert.match(referenceCSS('state-position'), /width:72px;height:72px/);
  assert.match(referenceCSS('state-behavior'), /width:min\(72px,18vw\)/);
  assert.match(referenceCSS('state-entrance'), /width:min\(72px,18vw\)/);
  assert.equal(compileReferenceAttributes(createScene(), { size: 231 }).size, 231);
});
test('native dropdowns share a logical text gutter and accessible system fallback', async () => {
  const css = await read('playground/native-select.css');
  for (const entry of ['playground/shared-header.css', 'playground/api-demo.css']) {
    assert.match(await read(entry), /@import '\.\/native-select\.css'/, `${entry} includes native-select styling in its own document`);
  }
  assert.match(css, /select:not\(\[multiple\]\):not\(\[size\]\)/);
  assert.match(css, /padding-inline-end: 36px/);
  assert.match(css, /background-position: right 12px center/);
  assert.match(css, /:dir\(rtl\)/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /appearance: auto/);
  assert.match(await read('playground/components/ui/select.tsx'), /py-2 px-3/);
});
