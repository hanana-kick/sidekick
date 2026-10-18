import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPackageConsumer } from './package-fixture.mjs';

const tsc = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
const compile = (consumer, source, extension = 'ts') => {
  const file = `consumer.${extension}`;
  writeFileSync(join(consumer.directory, file), source);
  return consumer.run([tsc, '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--jsx', 'react-jsx', '--lib', 'ES2022,DOM,DOM.Iterable', file]);
};

test('packed core installs offline without React, Studio, or lifecycle builds', t => {
  const consumer = createPackageConsumer(); t.after(consumer.cleanup);
  assert.deepEqual(consumer.manifest.dependencies ?? {}, {});
  assert.equal(consumer.manifest.private, true);
  assert.equal(consumer.manifest.peerDependenciesMeta.react.optional, true);
  for (const script of ['build', 'prepare', 'prepack', 'preinstall', 'install', 'postinstall']) assert.equal(consumer.manifest.scripts[script], undefined);
  for (const name of ['react', 'react-dom', 'vite', 'radix-ui', 'tailwindcss', 'shadcn', 'typescript']) assert.equal(existsSync(join(consumer.directory, 'node_modules', name)), false, `${name} leaked into core install`);
  const files = consumer.packed.files.map(file => file.path);
  assert.ok(files.every(file => file === 'package.json' || file === 'README.md' || file.startsWith('dist/library/') || file.startsWith('dist/browser/') || file.startsWith('third_party/material-shapes/')), files.join('\n'));
  assert.ok(files.includes('dist/library/react.d.ts'));
  for (const file of ['sidekick.js', 'sidekick.iife.js', 'sidekick-react.js', 'sidekick-element.js', 'sidekick-fallback.js', 'sidekick.worker.js']) assert.ok(files.includes('dist/browser/' + file));
  assert.ok(files.includes('third_party/material-shapes/LICENSE'));
  assert.ok(!files.some(file => /\.map$|playground|assets\//.test(file)));
  for (const entry of ['./dist/library/index.js', './dist/library/auto.js', './src/index.ts', './src/auto.ts', './dist/browser/sidekick.js', './dist/browser/sidekick.iife.js', '**/*.css']) assert.ok(consumer.manifest.sideEffects.includes(entry));
  assert.ok(!consumer.manifest.sideEffects.includes('./dist/library/register.js'));
  assert.ok(!consumer.manifest.sideEffects.includes('./dist/library/core.js'));
  // v0.8.0: ~644 KB including persistent DOM-anchor scheduler, types and documentation.
  // Keep a tight total budget and the independent no-React/no-Studio file assertions above.
  assert.ok(consumer.packed.size < 650_000, `Unexpected packed size ${consumer.packed.size}`);
  const output = consumer.run(['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    for (const suffix of ['', '/auto', '/register', '/core']) {
      const api = await import('@hanana-kick/sidekick' + suffix);
      assert.equal(api.createDesign().version, 7);
      assert.equal(api.wheelZoom, undefined); assert.equal(api.pinchZoom, undefined);
      assert.equal(api.createZoom(1.5), 1.5); assert.equal(api.ZOOM_RANGE.max, 3);
      if (suffix !== '/core') { assert.equal(typeof api.defineSidekick, 'function'); api.defineSidekick(); }
    }
    assert.equal(typeof globalThis.window, 'undefined');
    assert.equal(typeof globalThis.HTMLElement, 'undefined');
    console.log('SSR core imports passed');
  `]);
  assert.match(output, /SSR core imports passed/);
  compile(consumer, `
    import { createDesign, createBodyOrientation, type BodyOrientation, type AvatarDesign, type MaterialShapeName } from '@hanana-kick/sidekick/core';
    import { defineSidekick, type SidekickAvatar, type SidekickAttributes, type SidekickEventMap } from '@hanana-kick/sidekick/register';
    import '@hanana-kick/sidekick/auto';
    import { createScene as createBrowserScene } from '@hanana-kick/sidekick/browser/sidekick.js';
    console.log(createBrowserScene());
    const design: AvatarDesign = createDesign();
    const shape: MaterialShapeName = 'heart';
    const attrs: SidekickAttributes = { shape, 'tracking-mode': 'eyes-and-body', 'mouse-tracking': 'false', 'body-yaw': 12, 'zoom': 1.5 };
    const avatar: SidekickAvatar = document.createElement('sidekick-avatar');
    avatar.design = design; avatar.bodyOrientation = createBodyOrientation(); avatar.mouseTracking = true; avatar.trackingMode = 'eyes-and-body';
    const angles: BodyOrientation = { yaw: 12, pitch: 0, roll: 0 }; avatar.bodyOrientation = angles;
    avatar.zoom = 2; const full: BodyOrientation = avatar.bodyOrientation; console.log(full.yaw, avatar.zoom);
    avatar.addEventListener('sidekick-error', event => { const typed: SidekickEventMap['sidekick-error'] = event; console.log(typed.detail.message); });
    defineSidekick(); console.log(attrs);
    // @ts-expect-error unsupported shape
    const invalid: SidekickAttributes = { shape: 'arbitrary-polygon' };
    console.log(invalid);
  `);
});

test('packed React subpath supports strict types, refs, events and DOM-free server render', t => {
  const consumer = createPackageConsumer({ react: true }); t.after(consumer.cleanup);
  compile(consumer, `
    import { createRef } from 'react';
    import { SidekickAvatar, type SidekickAvatarProps, type SidekickAvatarRef } from '@hanana-kick/sidekick/react';
    import { createDesign } from '@hanana-kick/sidekick/core';
    import { SidekickAvatar as PrebuiltAvatar } from '@hanana-kick/sidekick/browser/sidekick-react.js';
    const prebuilt = <PrebuiltAvatar shape="heart" onError={event => console.log(event.detail.message)} />;
    console.log(prebuilt);
    const ref = createRef<SidekickAvatarRef>();
    const props: SidekickAvatarProps = { design: createDesign(), bodyOrientation: { yaw: 12 }, zoom: 2, trackingMode: 'eyes-and-body', mouseTracking: false, headAccessory: 'beret' };
    // @ts-expect-error Removed camera props are not compatibility aliases.
    const removedCamera: SidekickAvatarProps = { camera: { yaw: 12 } };
    // @ts-expect-error Zoom is independent from body orientation.
    const nestedZoom: SidekickAvatarProps = { bodyOrientation: { yaw: 12, zoom: 2 } };
    void removedCamera; void nestedZoom;
    const tree = <SidekickAvatar {...props} ref={ref} shape="heart" leftSmile={0.4} paused={false} onReady={event => event.detail} onError={event => console.log(event.detail.message)} onBodyOrientationChange={event => console.log(event.detail.bodyOrientation.yaw)} onZoomChange={event => console.log(event.detail.zoom)} onMotionEnd={event => console.log(event.detail.finished)} />;
    ref.current?.setShape('circle', { duration: 450 });
    // @ts-expect-error shape is a catalog name
    const wrong = <SidekickAvatar shape="anything" />;
    // @ts-expect-error incompatible slot preset
    const wrongSlot = <SidekickAvatar headAccessory="glasses" />;
    // @ts-expect-error callback receives CustomEvent, not a design directly
    const wrongEvent = <SidekickAvatar onDesignChange={event => event.body.color} />;
    console.log(tree, wrong, wrongSlot, wrongEvent);
  `, 'tsx');
  const output = consumer.run(['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createElement, createRef } from 'react';
    import { renderToString } from 'react-dom/server';
    import { SidekickAvatar } from '@hanana-kick/sidekick/react';
    const ref = createRef();
    const html = renderToString(createElement(SidekickAvatar, { id: 'server-avatar', shape: 'heart', paused: false, mouseTracking: true, bodyOrientation: { yaw: 15 }, style: { width: 240 }, 'aria-label': 'Companion', ref, onReady: () => { throw new Error('server event'); } }));
    assert.equal(html, '<sidekick-avatar id="server-avatar" style="width:240px" aria-label="Companion"></sidekick-avatar>');
    assert.equal(ref.current, null);
    assert.equal(typeof window, 'undefined');
    assert.equal(typeof HTMLElement, 'undefined');
    console.log(html);
  `]);
  assert.match(output, /server-avatar/);
  const reactSource = readFileSync(join(consumer.packagePath, 'dist/library/react.js'), 'utf8');
  assert.ok(reactSource.startsWith("'use client';"));
  assert.doesNotMatch(reactSource, /import\s+[^;]+from\s+['"].*element\/avatar/);
});


test('pinned local Git dependency installs prebuilt artifacts without the Studio toolchain', t => {
  const directory = mkdtempSync(join(tmpdir(), 'sidekick-git-consumer-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = fileURLToPath(new URL('..', import.meta.url));
  const repository = join(directory, 'package');
  const destination = join(directory, 'consumer');
  // This throwaway fixture is the only repository committed by this test. It has
  // no remote and never touches the working repository's index, HEAD or config.
  for (const path of ['package.json', 'README.md', 'dist/library', 'dist/browser', 'third_party/material-shapes']) cpSync(join(root, path), join(repository, path), { recursive: true });
  const git = args => execFileSync('git', args, { cwd: repository, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '--quiet']); git(['add', '.']);
  git(['-c', 'user.name=Package fixture', '-c', 'user.email=fixture@invalid.test', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Isolated package fixture']);
  const commit = git(['rev-parse', 'HEAD']);
  cpSync(repository + '/package.json', join(destination, 'fixture-package.json'));
  writeFileSync(join(destination, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  const output = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--offline', '--no-audit', '--no-fund', '--cache', join(directory, '.npm-cache'), `git+file://${repository}#${commit}`], { cwd: destination, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(output, /added 1 package/);
  assert.equal(existsSync(join(destination, 'node_modules/react')), false);
  assert.equal(existsSync(join(destination, 'node_modules/vite')), false);
  const installed = execFileSync(process.execPath, ['--input-type=module', '-e', "import {createDesign} from '@hanana-kick/sidekick'; console.log(createDesign().version)"], { cwd: destination, encoding: 'utf8' });
  assert.equal(installed.trim(), '7');
});
