import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const readme = read('../README.md');
const rows = readme.split('\n').filter(line => line.startsWith('| '));
const cells = rows.map(row => row.split(/(?<!\\)\|/).slice(1, -1).map(cell => cell.trim()));
function blockAfter(heading, language) {
  const start = readme.indexOf(heading);
  assert.notEqual(start, -1, `Missing heading: ${heading}`);
  const block = readme.slice(start).match(new RegExp('```' + language + '\\n([\\s\\S]*?)\\n```'))?.[1];
  assert.ok(block, `Missing ${language} example after ${heading}`);
  return block;
}
function typecheckExample(source, name, extension) {
  const file = fileURLToPath(new URL(`./docs-${name}.${extension}`, import.meta.url));
  const options = {
    strict: true, noEmit: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: ts.JsxEmit.ReactJSX, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    types: ['react'],
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, ...rest) => path === file
    ? ts.createSourceFile(path, source, languageVersion, true, extension === 'tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    : getSourceFile(path, languageVersion, ...rest);
  const program = ts.createProgram([file], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path,
    getCurrentDirectory: host.getCurrentDirectory,
    getNewLine: () => '\n',
  }));
}
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
  for (const [url] of readme.matchAll(/https:\/\/cdn\.jsdelivr\.net\/gh\/hanana-kick\/sidekick@[^\s'";<>]+/g)) {
    assert.ok(url.startsWith(base), `Unpinned or stale current CDN example: ${url}`);
  }
  assert.ok(readme.includes(`이 버전은 \`${manifest.version}\`입니다.`));
  assert.ok(readme.includes(`현재 CDN 권장 버전은 **${manifest.version}**입니다.`));
  for (const filename of ['sidekick-browser-' + manifest.version + '.zip', 'hanana-kick-sidekick-' + manifest.version + '.tgz']) {
    assert.ok(readme.includes(filename), `Missing current release asset: ${filename}`);
  }
});

test('README describes every movement state field and separate move/activity stops', () => {
  for (const field of interfaceProperties('../src/element/movement.ts', 'MovementState')) {
    assert.ok(cells.some(row => row[0] === '`' + field + '`' && row.length >= 2), `Missing movement state field: ${field}`);
  }
  const movement = readme.slice(readme.indexOf('## 렌더링·이동 표준'));
  for (const api of ['MoveOptions', 'MovementState', 'move-travel', 'moveTravel', 'sidekick-move-progress', 'onMoveProgress']) {
    assert.ok(movement.includes(api), `Missing movement API documentation: ${api}`);
  }
  for (const phase of ['idle', 'takeoff', 'flight', 'landing', 'braking', 'settling']) {
    assert.ok(movement.includes('`' + phase + '`'), `Missing movement phase: ${phase}`);
  }
  for (const option of ['maxSpeed', 'acceleration', 'deceleration']) assert.ok(movement.includes(option), `Missing physical movement option: ${option}`);
  assert.doesNotMatch(movement, /15% \(150ms\)|70% \(700ms\)/);
  assert.match(movement, /180ms/);
  assert.match(movement, /`cancelMove\(\)`는 이동만 중단하고 `stop\(\)`은 활동 재생만 중단/);
  assert.match(movement, /비행 도중 끝난 유한 재생을 다시 시작하거나/);
});

test('README natural-flight TypeScript and React examples compile against the public package', () => {
  typecheckExample(blockAfter('### 자연스러운 방향성 비행', 'ts'), 'movement', 'mts');
  typecheckExample(blockAfter('### React: 같은 엘리먼트 API를 ref로 사용', 'tsx'), 'movement-react', 'tsx');
});

test('README HTML stage handles mouse/touch coordinates and independent stop controls', t => {
  const html = blockAfter('### 클릭·터치한 곳으로 이동하는 HTML 무대', 'html');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const moves = [], plays = [];
  let moveStops = 0, activityStops = 0;
  class Avatar extends window.HTMLElement {
    get offsetWidth() { return 144; }
    get offsetHeight() { return 144; }
    moveTo(position, options) { moves.push({ position, options }); return Promise.resolve({ finished: true, position }); }
    play(activity, options) { plays.push({ activity, options }); return Promise.resolve({ finished: true }); }
    cancelMove() { moveStops++; }
    stop() { activityStops++; }
  }
  window.customElements.define('sidekick-avatar', Avatar);
  const document = window.document;
  const stage = document.getElementById('flight-stage');
  const avatar = document.getElementById('flight-avatar');
  Object.defineProperties(stage, { clientWidth: { value: 480 }, clientHeight: { value: 360 } });
  stage.getBoundingClientRect = () => ({ left: 40, top: 20, width: 480, height: 360 });
  const module = document.querySelector('script[type="module"]').textContent;
  const source = ts.createSourceFile('stage.js', module, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(source.parseDiagnostics.length, 0, 'HTML module must contain valid JavaScript');
  const imports = source.statements.filter(ts.isImportDeclaration);
  assert.equal(imports.length, 1, 'The standalone HTML example imports the auto-registering browser bundle once');
  const { version } = JSON.parse(read('../package.json'));
  assert.equal(imports[0].moduleSpecifier.text, `https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v${version}/dist/browser/sidekick.js`);
  window.eval(module.slice(imports[0].end));
  function pointer(clientX, clientY, pointerType, other = {}) {
    const event = new window.Event('pointerup', { bubbles: true });
    Object.assign(event, { clientX, clientY, pointerType, isPrimary: true, button: 0, ...other });
    stage.dispatchEvent(event);
  }
  pointer(300, 220, 'mouse');
  assert.deepEqual(JSON.parse(JSON.stringify(moves[0])), {
    position: { x: 188, y: 128 }, options: { duration: 1000, travel: 'natural', acceleration: 1800, deceleration: 2200 },
  });
  pointer(45, 25, 'touch');
  assert.deepEqual(JSON.parse(JSON.stringify(moves[1].position)), { x: 0, y: 0 });
  pointer(519, 379, 'touch');
  assert.deepEqual(JSON.parse(JSON.stringify(moves[2].position)), { x: 336, y: 216 });
  pointer(300, 220, 'mouse', { button: 2 });
  pointer(300, 220, 'touch', { isPrimary: false });
  assert.equal(moves.length, 3, 'Secondary buttons and secondary touches do not retarget');
  document.getElementById('flight-center').click();
  assert.deepEqual(JSON.parse(JSON.stringify(moves[3].position)), { x: 168, y: 108 });
  document.getElementById('flight-cancel').click();
  assert.equal(moveStops, 1); assert.equal(activityStops, 0);
  document.getElementById('flight-play').click();
  assert.deepEqual(JSON.parse(JSON.stringify(plays)), [{ activity: 'speaking', options: { duration: 2000 } }]);
  document.getElementById('flight-stop').click();
  assert.equal(moveStops, 1); assert.equal(activityStops, 1);
  avatar.dispatchEvent(new window.CustomEvent('sidekick-move-progress', { detail: { phase: 'landing' } }));
  assert.equal(document.getElementById('flight-status').textContent, 'landing');
  avatar.dispatchEvent(new window.CustomEvent('sidekick-move-end', { detail: { finished: true } }));
  assert.equal(document.getElementById('flight-status').textContent, '도착');
  avatar.dispatchEvent(new window.CustomEvent('sidekick-move-end', { detail: { finished: false } }));
  assert.equal(document.getElementById('flight-status').textContent, '이동 중단됨');
});

test('header and CDN examples use the canonical case-sensitive bowTie preset', async () => {
  const { resolveSidekickAttributes } = await import('../dist/library/element/attributes.js');
  assert.doesNotMatch(readme, /neck-accessory="bowtie"|neckAccessory:\s*'bowtie'/);
  const htmlExamples = [...readme.matchAll(/```html\n([\s\S]*?)\n```/g)];
  let checked = 0;
  for (const [, html] of htmlExamples) {
    const dom = new JSDOM(html);
    for (const avatar of dom.window.document.querySelectorAll('sidekick-avatar[neck-accessory="bowTie"]')) {
      const resolved = resolveSidekickAttributes(new Map([...avatar.attributes].map(a => [a.name, a.value])));
      assert.ok(resolved.design.accessories.some(a => a.preset === 'bowTie'));
      checked++;
    }
    dom.window.close();
  }
  assert.ok(checked > 0);
});


test('README states the eyes-and-body default and explicit legacy opt-out', () => {
  const trackingRow = cells.find(row => row[0] === '`tracking-mode`');
  assert.ok(trackingRow.some(cell => cell.includes('`eyes-and-body`(기본)')));
  assert.match(readme, /기본값은 `eyes-and-body`입니다/);
  assert.match(readme, /`bot\.mouseTracking = false`는 명시적인 `mouse-tracking="false"`/);
  assert.doesNotMatch(readme, /마우스 추적 꺼짐으로 돌아갑니다/);
});

test('body orientation and zoom documentation describes independent APIs and version 3 scenes', () => {
  for (const name of ['body-orientation', 'body-yaw', 'body-pitch', 'body-roll', 'bodyOrientation', 'bodyYaw', 'bodyPitch', 'bodyRoll', 'zoom', 'onBodyOrientationChange', 'onZoomChange']) {
    assert.ok(cells.some(row => row[0] === '`' + name + '`' || row[1] === '`' + name + '`'), `Missing new public API row: ${name}`);
  }
  assert.match(readme, /sceneVersion: 3/);
  assert.match(readme, /bot\.zoom = 1\.5/);
  assert.doesNotMatch(readme, /setCamera|cameraYaw|cameraZoom|camera-yaw|camera-zoom|sidekick-camera-change|createCamera|CameraState/);
  assert.doesNotMatch(readme, /bodyOrientation=\{\{zoom/);
});

const readmeLanguages = ['README.md', 'README.en.md', 'README.zh-CN.md', 'README.ja.md'];
const proseOnly = text => text.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
const fencedExamples = text => [...text.matchAll(/^```[^\n]*\n[\s\S]*?^```/gm)].map(match => match[0]);
const markdownSlug = heading => heading.toLowerCase().replace(/[^\p{L}\p{N}\p{M}\p{Pc}\-\s]/gu, '').replace(/ /g, '-');

test('four complete README languages preserve every executable example and API reference row', () => {
  const baseExamples = fencedExamples(readme);
  const baseHeadingLevels = [...proseOnly(readme).matchAll(/^(#{1,6}) /gm)].map(match => match[1]);
  const referenceKeys = text => [...proseOnly(text).matchAll(/^\| `([^`]+)` \|/gm)].map(match => match[1]).sort();
  const baseKeys = referenceKeys(readme);
  assert.ok(baseExamples.length >= 38, 'Full guide examples are retained');
  for (const file of readmeLanguages) {
    const translated = read('../' + file);
    assert.deepEqual(fencedExamples(translated), baseExamples, `${file}: executable examples must stay identical`);
    assert.deepEqual([...proseOnly(translated).matchAll(/^(#{1,6}) /gm)].map(match => match[1]), baseHeadingLevels,
      `${file}: every section must be translated, not abridged`);
    assert.deepEqual(referenceKeys(translated), baseKeys, `${file}: complete API/attribute/event tables`);
    assert.equal(proseOnly(translated).split('\n').filter(line => line.startsWith('|')).length,
      proseOnly(readme).split('\n').filter(line => line.startsWith('|')).length, `${file}: all table rows`);
    if (file !== 'README.md') {
      const withoutLanguageNavigation = proseOnly(translated).split('\n').filter(line => !line.includes('[한국어](README.md)')).join('\n');
      assert.doesNotMatch(withoutLanguageNavigation, /[가-힣]/, `${file}: untranslated Korean prose outside executable examples`);
    }
    for (const other of readmeLanguages) assert.ok(translated.includes(`](${other})`), `${file}: language link ${other}`);
    for (const contract of ['sidekick.studio.scene.v3', 'sceneVersion: 3', 'guide.html', 'BotBehavior', 'BehaviorResult',
      'behaviorState', 'stopBehavior()', 'anchor: true', 'detachAnchor()', 'OffscreenCanvas', '1350', '1800', '2200', '250ms']) {
      assert.ok(translated.includes(contract), `${file}: missing documented contract ${contract}`);
    }
    assert.doesNotMatch(translated, /`setView\(yaw,pitch\)`/, `${file}: removed public API must not return`);
  }
});

test('README translations have working local anchors, repository links, and identical external references', async () => {
  const { existsSync } = await import('node:fs');
  const links = text => [...text.matchAll(/\]\(([^\s)]+)\)/g)].map(match => match[1]);
  const external = text => [...new Set(links(text).filter(link => /^https?:/.test(link)).map(link => {
    const url = new URL(link);
    if (url.origin === 'https://sidekick.hananakick.cc' && url.pathname === '/guide.html') url.searchParams.delete('lang');
    return url.href;
  }))].sort();
  for (const file of readmeLanguages) {
    const translated = read('../' + file);
    const expectedLocale = {'README.en.md':'en','README.zh-CN.md':'zh-CN','README.ja.md':'ja'}[file];
    for (const link of links(translated)) if (link.startsWith('https://sidekick.hananakick.cc/guide.html?')) {
      const url = new URL(link); assert.equal(url.searchParams.get('lang'), expectedLocale, file + ': guide language must match README');
      assert.deepEqual([...url.searchParams.keys()], ['lang']);
      assert.ok(['#state-emotion','#loading','#html-start'].includes(url.hash));
    }
    const headings = [...proseOnly(translated).matchAll(/^#{1,6} (.+)$/gm)].map(match => markdownSlug(match[1]));
    assert.deepEqual(external(translated), external(readme), `${file}: preserve linked evidence/resources`);
    for (const link of links(translated)) {
      if (link.startsWith('#')) {
        assert.ok(headings.includes(decodeURIComponent(link.slice(1))), `${file}: broken heading ${link}`);
      } else if (!/^[a-z]+:/i.test(link)) {
        assert.ok(existsSync(new URL('../' + link.split('#')[0], import.meta.url)), `${file}: missing local link ${link}`);
      }
    }
  }
});

test('declarative positioning native and React public types compile', () => {
 typecheckExample(`import type { SidekickAvatar, Positioning } from '../src/index.js';
 const positioning: Positioning = { target: 'viewport', placement: 'bottom-right', gap: 16, follow: true };
 declare const bot: SidekickAvatar;
 bot.positioning = positioning;
 const x: number = bot.position.x;
 void x;
 bot.positioning = { target: document.body, placement: 'center-right', offset: { y: -8 } };
 bot.positioning = null;
 `, 'positioning-native', 'ts');
 typecheckExample(`import { SidekickAvatar, type Positioning } from '../src/react.js';
 const positioning: Positioning = { target: '#status', placement: 'center-right', gap: 16 };
 export default function Example() { return <SidekickAvatar placement="viewport" positioning={positioning} />; }
 `, 'positioning-react', 'tsx');
});
