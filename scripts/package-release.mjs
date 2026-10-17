import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReactPeers } from './build-react-peers.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
if (execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' }).trim()) {
  throw new Error('Commit the complete source and prebuilt artifacts before packaging a release.');
}
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const version = manifest.version;
if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error('Invalid release version');
const outputIndex = process.argv.indexOf('--output');
if (outputIndex !== -1 && !process.argv[outputIndex + 1]) throw new Error('--output requires a directory');
const output = resolve(outputIndex === -1 ? join(root, 'release') : process.argv[outputIndex + 1]);
await mkdir(output, { recursive: true });
const stage = await mkdtemp(join(tmpdir(), 'sidekick-release-'));
const browserFiles = ['sidekick.js', 'sidekick.iife.js', 'sidekick-react.js', 'sidekick-element.js', 'sidekick-fallback.js', 'sidekick.worker.js'];
const html = (title, body) => `<!doctype html>\n<html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px system-ui;margin:32px;background:#f1f5f9;color:#0f172a}sidekick-avatar{width:280px;height:280px;display:block}</style><body>${body}</body></html>\n`;
try {
  for (const file of browserFiles) await cp(join(root, 'dist/browser', file), join(stage, file));
  await cp(join(root, 'README.md'), join(stage, 'README.md'));
  await cp(join(root, 'third_party'), join(stage, 'third_party'), { recursive: true });
  await buildReactPeers(join(stage, 'vendor'));
  await writeFile(join(stage, 'esm.html'), html('Sidekick · ESM', `<h1>Sidekick · ESM</h1><sidekick-avatar shape="heart" body-color="#FFCC37" head-accessory="beret" left-smile="1" right-smile="1" tracking-mode="eyes-and-body" interaction="box" aria-label="나의 도우미"></sidekick-avatar><script type="module">import './sidekick.js';</script>`));
  await writeFile(join(stage, 'classic.html'), html('Sidekick · classic script', `<h1>Sidekick · classic script</h1><sidekick-avatar shape="puffy" body-color="#8bba9c" eyes-accessory="glasses" tracking-mode="eyes-and-body" interaction="box" aria-label="나의 도우미"></sidekick-avatar><script src="./sidekick.iife.js"></script><script>console.log('Sidekick design version:', Sidekick.createDesign().version);</script>`));
  await writeFile(join(stage, 'react.html'), html('Sidekick · React', `<h1>Sidekick · React</h1><div id="root"></div><script type="importmap">{"imports":{"react":"./vendor/react.js","react-dom/client":"./vendor/react-dom-client.js"}}</script><script type="module">import { createElement } from 'react';import { createRoot } from 'react-dom/client';import { SidekickAvatar } from './sidekick-react.js';createRoot(document.getElementById('root')).render(createElement(SidekickAvatar,{shape:'cookie6Sided',bodyColor:'#b7a5ce',headAccessory:'crown',trackingMode:'eyes',interaction:'box','aria-label':'나의 도우미',style:{width:280,height:280}}));</script>`));
  await writeFile(join(stage, 'START-HERE.txt'), `Sidekick ${version}\n\n압축을 푼 파일을 웹사이트의 정적 파일 디렉터리에 그대로 올리세요.\nesm.html, classic.html, react.html은 이미 빌드된 파일을 사용하는 예제입니다.\nfile:// 대신 HTTP(S) 주소로 여세요. 소스 빌드나 npm install은 필요하지 않습니다.\n\nsidekick.js + sidekick.worker.js: ESM, 자동 요소 등록\nsidekick.iife.js + sidekick.worker.js: 일반 script, 전역 Sidekick, 자동 요소 등록\nsidekick-react.js + sidekick-element.js + sidekick-fallback.js + sidekick.worker.js: React 래퍼와 렌더러\nvendor/: React 예제에서만 쓰는 선택적 React/ReactDOM 모듈과 라이선스\n\n전체 속성, props, 이벤트, API는 README.md를 확인하세요.\n라이브러리 코어는 React를 사용하지 않습니다.\n`);
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  await writeFile(join(stage, 'release.json'), JSON.stringify({ name: manifest.name, version, sourceCommit, repository: 'https://github.com/hanana-kick/sidekick', browserFiles, examples: ['esm.html', 'classic.html', 'react.html'], optionalReactPeers: manifest.devDependencies.react }, null, 2) + '\n');
  const epoch = Number(execFileSync('git', ['show', '-s', '--format=%ct', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
  const files = [];
  async function walk(directory, prefix = '') {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = prefix + entry.name, path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path, name + '/');
      else { files.push(name); await utimes(path, epoch, epoch); }
    }
  }
  await walk(stage);
  const archive = join(output, `sidekick-browser-${version}.zip`);
  await rm(archive, { force: true });
  execFileSync('zip', ['-q', '-X', archive, ...files], { cwd: stage });
  const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', output, '--json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }))[0];
  const assets = [archive, join(output, packed.filename)];
  const hashes = await Promise.all(assets.map(async path => `${createHash('sha256').update(await readFile(path)).digest('hex')}  ${basename(path)}`));
  await writeFile(join(output, 'SHA256SUMS'), hashes.join('\n') + '\n');
  console.log(JSON.stringify({ version, sourceCommit, output, browserFiles: files, assets: assets.map(path => basename(path)), sha256: hashes }, null, 2));
} finally { await rm(stage, { recursive: true, force: true }); }
