import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const readme = read('../README.md');
const rows = readme.split('\n').filter(line => line.startsWith('| '));
const cells = rows.map(row => row.split(/(?<!\\)\|/).slice(1, -1).map(cell => cell.trim()));
function interfaceProperties(path, name) {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = source.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === name);
  assert.ok(declaration, `${name} exists in ${path}`);
  return declaration.members.filter(ts.isPropertySignature).map(member => member.name.text);
}

test('README has an individual reference row for every HTML attribute and own React prop', () => {
  const attributes = interfaceProperties('../src/element/attributes.ts', 'SidekickAttributes');
  const props = interfaceProperties('../src/react.ts', 'SidekickAvatarProps');
  for (const attribute of attributes) {
    assert.ok(cells.some(row => row[0] === '`' + attribute + '`' && row.length >= 3), `Missing HTML attribute row: ${attribute}`);
  }
  for (const prop of props) {
    assert.ok(cells.some(row => (row[0] === '`' + prop + '`' || row[1] === '`' + prop + '`') && row.length >= 3), `Missing React prop row: ${prop}`);
  }
});

test('README includes complete self-hosted ESM, classic, and no-build React HTML examples', () => {
  const documents = [...readme.matchAll(/```html\n(<!doctype html>[\s\S]*?)\n```/g)].map(match => match[1]);
  assert.equal(documents.length, 3);
  const [esm, classic, react] = documents;
  for (const html of documents) {
    assert.match(html, /<html[\s>]/);
    assert.match(html, /<head>/);
    assert.match(html, /<body>/);
    assert.match(html, /<\/html>$/);
    assert.doesNotMatch(html, /https?:\/\//, 'Examples must use downloaded files without unverified external module URLs');
  }
  assert.match(esm, /import\('\/vendor\/sidekick\/sidekick\.js'\)/);
  assert.match(classic, /<script src="\/vendor\/sidekick\/sidekick\.iife\.js"><\/script>/);
  assert.match(classic, /Sidekick\.createAccessory/);
  assert.match(react, /"react": "\.\/vendor\/react\.js"/);
  assert.match(react, /"react-dom\/client": "\.\/vendor\/react-dom-client\.js"/);
  assert.match(react, /from '\.\/sidekick-react\.js'/);
  assert.match(react, /createElement as h/);
});

test('README leads with public HTTPS Git installation and a reproducible release tag', () => {
  const firstShell = readme.match(/```sh\n([\s\S]*?)\n```/)?.[1];
  assert.equal(firstShell, 'npm install https://github.com/hanana-kick/sidekick.git');
  const { version } = JSON.parse(read('../package.json'));
  assert.ok(readme.includes(`npm install https://github.com/hanana-kick/sidekick.git#v${version}`));
  assert.doesNotMatch(readme, /비공개|git\+ssh:|credential helper|COMMIT_SHA/);
  assert.match(readme, /npm 레지스트리에는 발행하지 않았으므로/);
});

test('CDN guide pins current browser bundles and one shared React peer graph', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const base = `https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v${manifest.version}/`;
  for (const file of ['sidekick.js', 'sidekick.iife.js', 'sidekick-react.js']) {
    assert.ok(readme.includes(base + 'dist/browser/' + file), file);
  }
  for (const file of ['react.js', 'react-dom-client.js']) {
    assert.ok(readme.includes(base + 'cdn/react-19.3.1/' + file), file);
  }
  assert.match(readme, /worker-src 'self' blob:/);
  assert.match(readme, /0\.2\.7.*변경하지/);
});
