import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { buildPluginSdk } from '../scripts/build-plugin-sdk.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const manifest = JSON.parse(read('package.json'));
function files(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(join(directory, entry.name), prefix + entry.name + '/') : [prefix + entry.name]).sort();
}

test('standalone SDK has an exact declaration closure and reproducible contents across distinct library roots', async t => {
  const expected = new Set();
  const pending = ['plugin-sdk.d.ts'];
  while (pending.length) {
    const name = pending.pop();
    if (expected.has(name)) continue;
    expected.add(name);
    for (const dependency of ts.preProcessFile(read('dist/library/' + name), true, true).importedFiles) {
      assert.match(dependency.fileName, /^\..*\.js$/);
      pending.push(relative(join(root, 'dist/library'), resolve(root, 'dist/library', dirname(name), dependency.fileName.replace(/\.js$/, '.d.ts'))));
    }
  }
  assert.deepEqual(files(join(root, 'dist/plugin-sdk/types/esm')), [...expected].sort());
  assert.deepEqual(files(join(root, 'dist/plugin-sdk/types/cjs')), [...expected].map(name => name.replace(/\.d\.ts$/, '.d.cts')).sort());
  assert.ok(![...expected].some(name => /^(?:renderer|element|runtime)\//.test(name)), 'SDK types must not expose browser/renderer internals');
  for (const name of files(join(root, 'dist/plugin-sdk/types/cjs'))) {
    for (const dependency of ts.preProcessFile(read('dist/plugin-sdk/types/cjs/' + name), true, true).importedFiles) assert.match(dependency.fileName, /\.cjs$/);
  }
  const temporary = mkdtempSync(join(tmpdir(), 'sidekick-sdk-rebuild-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const output = join(temporary, 'original-output');
  mkdirSync(output);
  writeFileSync(join(output, 'stale.txt'), 'must be removed by the builder');
  await buildPluginSdk({ outputDirectory: output });
  // Reproduce build-library --check, whose compiler writes equivalent modules
  // beneath a separate temporary root. A second output directory alone does not
  // catch checkout-dependent paths in Rolldown's module-region comments.
  const relocated = join(temporary, 'different/nesting/checkout');
  mkdirSync(join(relocated, 'dist'), { recursive: true });
  cpSync(join(root, 'package.json'), join(relocated, 'package.json'));
  cpSync(join(root, 'dist/library'), join(relocated, 'dist/library'), { recursive: true });
  const relocatedOutput = join(relocated, 'dist/plugin-sdk');
  await buildPluginSdk({ libraryDirectory: join(relocated, 'dist/library'), outputDirectory: relocatedOutput });
  assert.deepEqual(files(output), files(relocatedOutput));
  for (const name of files(output)) assert.deepEqual(readFileSync(join(output, name)), readFileSync(join(relocatedOutput, name)), `relocated input: ${name}`);
  const committed = join(root, 'dist/plugin-sdk');
  assert.deepEqual(files(output), files(committed));
  for (const name of files(output)) assert.deepEqual(readFileSync(join(output, name)), readFileSync(join(committed, name)), name);
});

test('release SDK ZIP extracts, installs offline and interoperates with the runtime in ESM, CommonJS and strict TypeScript', async t => {
  const fixture = mkdtempSync(join(tmpdir(), 'sidekick-sdk-release-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  for (const file of ['LICENSE', '.gitignore', 'package.json', 'README.md', 'README.en.md', 'README.ja.md', 'README.zh-CN.md', 'docs/plugin-sdk.md', 'examples/plugin-sdk', 'dist/library', 'dist/browser', 'dist/plugin-sdk', 'third_party', 'scripts/package-release.mjs', 'scripts/build-react-peers.mjs']) {
    cpSync(join(root, file), join(fixture, file), { recursive: true });
  }
  symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'junction');
  const run = (command, args, cwd = fixture) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, npm_config_cache: join(fixture, '.cache') } });
  const commit = message => run('git', ['-c', 'user.name=SDK fixture', '-c', 'user.email=fixture@invalid.test', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', message]);
  run('git', ['init', '--quiet']); run('git', ['add', '.']); commit('Isolated SDK release fixture');
  writeFileSync(join(fixture, '.git/info/exclude'), '.cache/\nconsumer/\nextracted-sdk/\n');
  const result = JSON.parse(run(process.execPath, ['scripts/package-release.mjs']));
  const archiveName = `sidekick-plugin-sdk-${manifest.version}.zip`;
  assert.equal(result.version, manifest.version);
  assert.equal(result.assets.length, 3);
  assert.ok(result.assets.includes(archiveName));
  assert.ok(result.assets.includes(`sidekick-browser-${manifest.version}.zip`));
  const sums = readFileSync(join(fixture, 'release/SHA256SUMS'), 'utf8').trim().split('\n');
  assert.deepEqual(sums, result.sha256);
  for (const asset of result.assets) {
    const digest = createHash('sha256').update(readFileSync(join(fixture, 'release', asset))).digest('hex');
    assert.ok(sums.includes(`${digest}  ${asset}`), `${asset} missing or incorrect checksum`);
  }
  const sdk = join(fixture, 'extracted-sdk');
  mkdirSync(sdk);
  run('unzip', ['-q', join(fixture, 'release', archiveName), '-d', sdk]);
  assert.deepEqual(files(sdk), [...result.pluginSdkFiles].sort());
  const sdkManifest = JSON.parse(readFileSync(join(sdk, 'package.json'), 'utf8'));
  assert.equal(sdkManifest.name, '@hanana-kick/sidekick-plugin-sdk');
  assert.equal(sdkManifest.version, manifest.version);
  assert.equal(sdkManifest.private, true);
  assert.equal(sdkManifest.sideEffects, false);
  for (const field of ['dependencies', 'peerDependencies', 'devDependencies', 'scripts']) assert.equal(sdkManifest[field], undefined);
  assert.equal(readFileSync(join(sdk, 'README.md'), 'utf8'), read('docs/plugin-sdk.md'));
  assert.equal(readFileSync(join(sdk, 'rigging.md'), 'utf8'), read('docs/rigging.md'));
  for (const file of files(join(root, 'examples/plugin-sdk'))) assert.equal(readFileSync(join(sdk, 'examples', file), 'utf8'), read('examples/plugin-sdk/' + file));
  const metadata = JSON.parse(readFileSync(join(sdk, 'release.json'), 'utf8'));
  assert.equal(metadata.sourceCommit, result.sourceCommit);
  assert.equal(metadata.version, manifest.version);
  assert.deepEqual(metadata.runtime, { name: manifest.name, version: manifest.version });
  assert.deepEqual(metadata.formats, ['esm', 'commonjs']);
  for (const filename of ['index.js', 'index.cjs']) {
    const source = readFileSync(join(sdk, filename), 'utf8');
    assert.ok(source.includes(read('LICENSE')), 'bundles retain the authoritative license');
    assert.doesNotMatch(source, /class AccessoryPluginRegistry|\bHTMLElement\b|\bcustomElements\b|\bWebGLRenderingContext\b|from ['"]react['"]/);
  }
  const consumer = join(fixture, 'consumer');
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'sidekick-sdk-offline-consumer', private: true, type: 'module', dependencies: { [sdkManifest.name]: `file:${sdk}` } }));
  run('npm', ['install', '--offline', '--ignore-scripts', '--install-links', '--no-audit', '--no-fund'], consumer);
  for (const name of ['react', 'react-dom', 'typescript', 'vite', '@hanana-kick/sidekick']) assert.equal(existsSync(join(consumer, 'node_modules', name)), false);
  const smoke = `
    const assert = ASSERT;
    assert.equal(typeof sdk.defineAccessoryPlugin, 'function');
    assert.equal(typeof sdk.defineAccessoryGeometry, 'function');
    assert.equal(typeof sdk.definePartAnimation, 'function');
    assert.equal(typeof sdk.createPairedAffineDeformation, 'function');
    assert.equal(typeof sdk.getAccessoryPluginEyeMeasurements, 'function');
    assert.equal(typeof sdk.validateAccessoryPluginDeformation, 'function');
    assert.equal(typeof sdk.validateAccessoryPluginSurfaceConnectors, 'function');
    assert.ok(Object.isFrozen(sdk.ACCESSORY_PLUGIN_DEFORMATION_LIMITS));
    assert.equal(sdk.AccessoryPluginRegistry, undefined);
    const geometry = sdk.defineAccessoryGeometry({ vertices: new Float32Array([0,0,0,0,0,1, .1,0,0,0,0,1, 0,.1,0,0,0,1]), indices: new Uint16Array([0,1,2]) });
    const plugin = sdk.defineAccessoryPlugin({ apiVersion: 1, id: 'release/test', slots: ['head'], createMesh: () => geometry });
    assert.equal(plugin.id, 'release/test');
    assert.equal(plugin.createMesh().indices.length, 3);
    const authored = {
      channels: { radius: { combine: 'max', factors: [1.28, .64] }, tube: { combine: 'min', factors: [.0845, .0845] } },
      vertices: [
        { eyeBlend: 0, coefficients: { radius: [1, 0, 0] } },
        { eyeBlend: 1, coefficients: { radius: [-1, 0, 0] } },
        { eyeBlend: .5, basePosition: [0, 0, .01], coefficients: { tube: [0, 0, 1] } },
      ],
    };
    const authoredBefore = structuredClone(authored);
    const deformation = sdk.createPairedAffineDeformation(authored);
    assert.deepEqual(authored, authoredBefore);
    assert.equal(deformation.kind, 'paired-affine');
    assert.deepEqual(deformation.eyeBlend, new Float64Array([0, 1, .5]));
    assert.equal(deformation.channels[0].measurement, 'eye-size');
    const validated = sdk.validateAccessoryPluginDeformation(deformation, 3);
    assert.deepEqual(validated, deformation);
    assert.notEqual(validated.eyeBlend.buffer, deformation.eyeBlend.buffer);
    assert.notEqual(validated.channels[0].coefficients.buffer, deformation.channels[0].coefficients.buffer);
    authored.channels.radius.factors[0] = 2;
    assert.equal(deformation.channels[0].factors[0], 1.28);
    assert.throws(() => sdk.createPairedAffineDeformation({ ...authored, vertices: [{ eyeBlend: 2 }] }), /eye blend/);
    assert.throws(() => sdk.validateAccessoryPluginDeformation(deformation, 4), /length/);
    const connector = { kind: 'surface-tube', to: [.044, -.006, .012], radius: .0085, rings: 8, sides: 8, material: { color: '#AABBCC' } };
    const connectors = sdk.validateAccessoryPluginSurfaceConnectors([connector], 3, 3);
    assert.equal(connectors[0].material.color, '#aabbcc');
    assert.notEqual(connectors[0].to, connector.to);
    assert.throws(() => sdk.validateAccessoryPluginSurfaceConnectors([{ ...connector, rings: 1 }], 3, 3), /rings/);
    const extended = sdk.defineAccessoryGeometry({ ...geometry, deformation, surfaceConnectors: connectors, normalPrecision: 'float32' });
    assert.deepEqual(extended.deformation, deformation);
    assert.notEqual(extended.deformation.basePositions.buffer, deformation.basePositions.buffer);
    assert.deepEqual(extended.surfaceConnectors, connectors);
    assert.notEqual(extended.surfaceConnectors[0].to, connectors[0].to);
    assert.deepEqual(structuredClone(extended), extended);
    const design = { version: 7, body: { shape: 'square', color: '#ffcc37' }, eyes: { color: '#24242c', left: { weights: { smile: 0, blink: 0 } }, right: { weights: { smile: 0, blink: 0 } } }, accessories: [] };
    const designBefore = structuredClone(design), options = { face: [.04, -.02], squash: .93 };
    const measurements = sdk.getAccessoryPluginEyeMeasurements(design, options);
    assert.ok([...measurements.left, ...measurements.right, ...measurements.size].every(Number.isFinite));
    assert.ok(measurements.left[0] < measurements.right[0]);
    assert.ok(measurements.size.every(value => value > 0));
    assert.deepEqual(design, designBefore);
    assert.notDeepEqual(measurements, sdk.getAccessoryPluginEyeMeasurements(design, { ...options, face: [0, 0] }));
    design.eyes.left.weights.smile = 1; design.eyes.right.weights.blink = 1;
    assert.deepEqual(sdk.getAccessoryPluginEyeMeasurements(design, options), measurements);
    const measurementsAgain = sdk.getAccessoryPluginEyeMeasurements(design, options);
    assert.notEqual(measurementsAgain.left, measurements.left);
    assert.notEqual(measurementsAgain.size, measurements.size);
    assert.throws(() => sdk.getAccessoryPluginEyeMeasurements(design, { squash: NaN }), /measurement pose/);
    assert.equal(typeof globalThis.document, 'undefined');
    assert.equal(typeof globalThis.HTMLElement, 'undefined');
    console.log('SDK offline import passed');
  `;
  assert.match(run(process.execPath, ['--input-type=module', '-e', `import * as sdk from '@hanana-kick/sidekick-plugin-sdk'; import assertModule from 'node:assert/strict'; ${smoke.replace('ASSERT', 'assertModule')}`], consumer), /SDK offline import passed/);
  assert.match(run(process.execPath, ['--input-type=commonjs', '-e', `const sdk = require('@hanana-kick/sidekick-plugin-sdk'); ${smoke.replace('ASSERT', "require('node:assert/strict')")}`], consumer), /SDK offline import passed/);
  const installedSdk = join(consumer, 'node_modules/@hanana-kick/sidekick-plugin-sdk');
  // These are the actual author files extracted from the release ZIP, not source
  // checkout imports. They must load before the separate runtime is installed.
  const catalogDescriptors = [
    ['halo.js', 'default', 'catalog/halo', 'head', 'crown-envelope'],
    ['glasses.js', 'default', 'catalog/glasses', 'eyes', 'eye-plane'],
    ['moustache.js', 'default', 'catalog/moustache', 'mouth', 'contained-front'],
    ['bow-tie.js', 'default', 'catalog/bow-tie', 'neck', 'contained-front'],
    ['earring.js', 'leftEarring', 'catalog/earring-left', 'leftEar', 'perimeter-front'],
    ['earring.js', 'rightEarring', 'catalog/earring-right', 'rightEar', 'perimeter-front'],
  ].map(([file, exportName, id, slot, mode]) => ({ url: pathToFileURL(join(installedSdk, 'examples/catalog', file)).href, exportName, id, slot, mode }));
  const catalogImports = `
    const catalog = await Promise.all(${JSON.stringify(catalogDescriptors)}.map(async item => {
      const module = await import(item.url);
      const plugin = module[item.exportName];
      assert.equal(plugin.id, item.id);
      assert.deepEqual(plugin.slots, [item.slot]);
      assert.equal(plugin.attachment.mode, item.mode);
      return { ...item, plugin };
    }));
    assert.equal(new Set(catalog.map(item => item.id)).size, 6);
  `;
  const catalogSmoke = run(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import * as esm from '@hanana-kick/sidekick-plugin-sdk';
    const commonjs = createRequire(import.meta.url)('@hanana-kick/sidekick-plugin-sdk');
    ${catalogImports}
    assert.deepEqual(catalog.map(item => item.slot).sort(), [...esm.ACCESSORY_SLOTS].sort());
    const design = { version: 7, body: { shape: 'square', color: '#ffcc37' }, eyes: { color: '#24242c', left: { weights: { smile: 0, blink: 0 } }, right: { weights: { smile: 0, blink: 0 } } }, accessories: [] };
    for (const sdk of [esm, commonjs]) for (const { plugin, slot } of catalog) {
      const source = await plugin.createMesh(), before = structuredClone(source);
      const geometry = sdk.validateAccessoryPluginGeometry(source);
      const attachment = sdk.validateAccessoryPluginAttachment(plugin.attachment);
      assert.deepEqual(source, before);
      assert.notEqual(geometry.vertices.buffer, source.vertices.buffer);
      assert.notEqual(geometry.indices.buffer, source.indices.buffer);
      assert.deepEqual(structuredClone(geometry), geometry);
      if (slot === 'eyes') {
        assert.equal(geometry.deformation.kind, 'paired-affine');
        assert.equal(geometry.deformation.eyeBlend.length, geometry.vertices.length / 6);
        assert.equal(geometry.normalPrecision, 'float32');
        assert.notEqual(geometry.deformation.channels[0].coefficients.buffer, source.deformation.channels[0].coefficients.buffer);
      }
      if (slot === 'leftEar' || slot === 'rightEar') {
        assert.equal(geometry.surfaceConnectors.length, 1);
        assert.equal(geometry.surfaceConnectors[0].kind, 'surface-tube');
        assert.notEqual(geometry.surfaceConnectors[0].to, source.surfaceConnectors[0].to);
      }
      for (const shape of Object.keys(attachment.mounts)) {
        const body = { ...design.body, shape };
        const eyes = sdk.getAccessoryPluginEyeMeasurements({ ...design, body });
        const frame = sdk.getAccessoryPluginAttachmentFrame(body, attachment, { eyes });
        assert.ok([...frame.position, ...frame.matrix, frame.scale].every(Number.isFinite));
      }
    }
    const { allSlotsAnimation } = await import(${JSON.stringify(pathToFileURL(join(installedSdk, 'examples/catalog/all-slots-animation.js')).href)});
    const animation = esm.validatePartAnimation(allSlotsAnimation);
    assert.equal(animation.tracks.length, 6);
    assert.deepEqual(Object.keys(esm.samplePartAnimation(animation, .5).accessories).sort(), ['plugin-halo', 'plugin-glasses', 'plugin-moustache', 'plugin-bow-tie', 'plugin-earring-left', 'plugin-earring-right'].sort());
    assert.equal(typeof globalThis.document, 'undefined');
    assert.equal(typeof globalThis.HTMLElement, 'undefined');
    console.log('Six-slot release authors validated without the runtime');
  `], consumer);
  assert.match(catalogSmoke, /Six-slot release authors validated without the runtime/);
  assert.equal(existsSync(join(consumer, 'node_modules/@hanana-kick/sidekick')), false);
  assert.match(run(process.execPath, [join(installedSdk, 'examples/validate.mjs')], consumer), /Starter mesh and independent animation validated/);
  assert.match(run(process.execPath, [join(installedSdk, 'examples/catalog/validate.mjs')], consumer), /All six catalog slots and independent animation validated/);
  run(process.execPath, [join(installedSdk, 'examples/build.mjs')], consumer);
  assert.ok(existsSync(join(installedSdk, 'examples/generated/badge.js')), 'the packaged starter must build without a toolchain');
  cpSync(join(installedSdk, 'examples/generated/badge.js'), join(consumer, 'starter.js'));
  // Compile both module modes with ES2022 only: authoring the SDK needs no DOM,
  // React, Node typings, build tool dependencies or access to a package registry.
  const typeSource = `
    import {
      defineAccessoryPlugin, defineAccessoryGeometry, createPairedAffineDeformation,
      validateAccessoryPluginDeformation, validateAccessoryPluginSurfaceConnectors,
      getAccessoryPluginEyeMeasurements, getAccessoryPluginAttachmentFrame,
      type AccessoryPlugin, type AccessoryPluginGeometry, type AccessoryPluginAttachment,
      type AccessoryPluginSurfaceConnector, type AccessoryPluginEyeMeasurements,
      type AccessoryPluginEyeMeasurementOptions, type AccessoryPluginAttachmentFrameOptions,
      type PairedAffineAuthoring, type PairedAffineAuthorChannel, type PairedAffineAuthorVertex,
      type PairedAffineDeformation, type PairedAffineChannel,
    } from '@hanana-kick/sidekick-plugin-sdk';
    const plugin = defineAccessoryPlugin({ apiVersion: 1, id: 'release/test', slots: ['head'], createMesh: () => defineAccessoryGeometry({ vertices: new Float32Array([0,0,0,0,0,1, .1,0,0,0,0,1, 0,.1,0,0,0,1]), indices: new Uint16Array([0,1,2]) }) });
    const typed: AccessoryPlugin = plugin;
    const id: 'release/test' = plugin.id;
    const authorChannel: PairedAffineAuthorChannel = { combine: 'max', factors: [1.28, .64] };
    const authorVertex: PairedAffineAuthorVertex = { eyeBlend: 0, basePosition: [0, 0, .01], coefficients: { radius: [1, 0, 0] } };
    const authoring: PairedAffineAuthoring = { channels: { radius: authorChannel }, vertices: [authorVertex, { eyeBlend: 1 }, { eyeBlend: .5 }] };
    const deformation: PairedAffineDeformation = createPairedAffineDeformation(authoring);
    const channel: PairedAffineChannel = validateAccessoryPluginDeformation(deformation, 3).channels[0]!;
    const connector: AccessoryPluginSurfaceConnector = { kind: 'surface-tube', to: [.044, -.006, .012], radius: .0085, rings: 8, sides: 8, material: { color: '#aabbcc', multiplier: .8 } };
    const geometry: AccessoryPluginGeometry = defineAccessoryGeometry({ ...plugin.createMesh(), deformation, surfaceConnectors: validateAccessoryPluginSurfaceConnectors([connector], 3, 3), normalPrecision: 'float32' });
    const design: Parameters<typeof getAccessoryPluginEyeMeasurements>[0] = { version: 7, body: { shape: 'square', color: '#ffcc37' }, eyes: { color: '#24242c', left: { weights: { smile: 0, blink: 0 } }, right: { weights: { smile: 0, blink: 0 } } }, accessories: [] };
    const options: AccessoryPluginEyeMeasurementOptions = { face: [.04, -.02], squash: .93 };
    const eyes: AccessoryPluginEyeMeasurements = getAccessoryPluginEyeMeasurements(design, options);
    const frameOptions: AccessoryPluginAttachmentFrameOptions = { eyes, squash: .93 };
    declare const attachment: AccessoryPluginAttachment;
    const frame = getAccessoryPluginAttachmentFrame(design.body, attachment, frameOptions);
    const fitted: AccessoryPlugin = defineAccessoryPlugin({ apiVersion: 1, id: 'release/fitted', slots: ['eyes'], attachment, createMesh: () => geometry });
    void [typed, id, channel, eyes, frame, fitted];
    // @ts-expect-error reductions are bounded data operations, not arbitrary expressions.
    createPairedAffineDeformation({ channels: { radius: { combine: 'sum', factors: [1, 1] } }, vertices: [{ eyeBlend: 0 }] });
    // @ts-expect-error neutral eye measurements do not accept gaze pose.
    getAccessoryPluginEyeMeasurements(design, { gaze: [0, 0] });
    // @ts-expect-error connector endpoints require three coordinates.
    const invalidConnector: AccessoryPluginSurfaceConnector = { kind: 'surface-tube', to: [0, 0], radius: .01, rings: 8, sides: 8 };
    void invalidConnector;
    // @ts-expect-error invalid equipment slot must be rejected by the published types.
    defineAccessoryPlugin({ apiVersion: 1, id: 'invalid', slots: ['shoe'], createMesh: plugin.createMesh });
  `;
  writeFileSync(join(consumer, 'author.mts'), typeSource);
  writeFileSync(join(consumer, 'author.cts'), typeSource);
  writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', lib: ['ES2022'], types: [] }, files: ['author.mts', 'author.cts'] }));
  run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], consumer);
  const tarball = join(fixture, 'release', result.assets.find(file => file.endsWith('.tgz')));
  run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tarball], consumer);
  writeFileSync(join(consumer, 'author.mts'), typeSource + `\nimport type { AccessoryPlugin as RuntimePlugin } from '@hanana-kick/sidekick/core';\nconst runtimeTyped: RuntimePlugin = typed; const runtimeFitted: RuntimePlugin = fitted; void runtimeTyped; void runtimeFitted;\n`);
  run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json', '--lib', 'ES2022,DOM,DOM.Iterable'], consumer);
  const interop = run(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import * as esm from '@hanana-kick/sidekick-plugin-sdk';
    import starter from './starter.js';
    import { AccessoryPluginRegistry } from '@hanana-kick/sidekick/core';
    const commonjs = createRequire(import.meta.url)('@hanana-kick/sidekick-plugin-sdk');
    ${catalogImports}
    const registry = new AccessoryPluginRegistry();
    const lazy = new AccessoryPluginRegistry();
    for (const { plugin, slot, mode } of catalog) {
      registry.register(plugin);
      lazy.registerLazy(plugin.id, async () => ({ default: plugin }));
      const [eagerAsset, lazyAsset] = await Promise.all([registry.load(plugin.id), lazy.load(plugin.id)]);
      assert.deepEqual(eagerAsset, lazyAsset);
      assert.deepEqual(eagerAsset.slots, [slot]);
      assert.equal(eagerAsset.attachment.mode, mode);
      assert.notEqual(eagerAsset.geometry.vertices.buffer, lazyAsset.geometry.vertices.buffer);
      assert.deepEqual(structuredClone(eagerAsset), eagerAsset);
      if (slot === 'eyes') {
        const original = eagerAsset.geometry.deformation.channels[0].coefficients[0];
        eagerAsset.geometry.deformation.channels[0].coefficients[0] = 15;
        assert.equal((await registry.load(plugin.id)).geometry.deformation.channels[0].coefficients[0], original);
      }
      if (slot === 'leftEar' || slot === 'rightEar') {
        const original = eagerAsset.geometry.surfaceConnectors[0].to[0];
        eagerAsset.geometry.surfaceConnectors[0].to[0] = 15;
        assert.equal((await registry.load(plugin.id)).geometry.surfaceConnectors[0].to[0], original);
      }
    }
    lazy.dispose();
    registry.register(starter);
    assert.equal((await registry.load(starter.id)).geometry.indices.length, 6);
    for (const [format, sdk] of [['esm', esm], ['cjs', commonjs]]) {
      registry.register(sdk.defineAccessoryPlugin({ apiVersion: 1, id: 'release/' + format, slots: ['head'], createMesh: () => sdk.defineAccessoryGeometry({ vertices: new Float32Array([0,0,0,0,0,1, .1,0,0,0,0,1, 0,.1,0,0,0,1]), indices: new Uint16Array([0,1,2]) }) }));
      const asset = await registry.load('release/' + format);
      assert.equal(asset.pluginId, 'release/' + format); assert.equal(asset.geometry.indices.length, 3);
    }
    registry.dispose(); console.log('SDK runtime interoperability passed');
  `], consumer);
  assert.match(interop, /SDK runtime interoperability passed/);
  // A release must not silently combine a new runtime with an older SDK build.
  const changed = { ...JSON.parse(readFileSync(join(fixture, 'package.json'), 'utf8')), version: '999.0.0' };
  writeFileSync(join(fixture, 'package.json'), JSON.stringify(changed, null, 2) + '\n');
  run('git', ['add', 'package.json']); commit('Deliberately stale SDK metadata');
  assert.throws(() => run(process.execPath, ['scripts/package-release.mjs']), /Plugin SDK metadata is stale/);
});
